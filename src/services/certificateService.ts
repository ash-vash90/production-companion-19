import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { triggerWebhook } from '@/lib/webhooks';
import { getTemplateForProduct, fillTemplate, CertificateTemplate } from './pdfTemplateService';

interface CertificateData {
  workOrderItem: {
    id: string;
    serial_number: string;
    work_order: {
      wo_number: string;
      product_type: string;
      batch_size: number;
    };
  };
  measurements: Array<{
    step_number: number;
    step_title: string;
    measurement_values: Record<string, unknown>;
    validation_status: string;
    operator_initials: string;
    completed_at: string;
  }>;
  batchMaterials: Array<{
    material_type: string;
    batch_number: string;
    opening_date?: string;
  }>;
  subAssemblies: Array<{
    component_type: string;
    child_serial_number: string;
  }>;
  generatedBy: string;
}

/**
 * Fetch all data needed for certificate generation
 */
async function fetchCertificateData(itemId: string): Promise<CertificateData> {
  // Fetch work order item with work order details
  const { data: itemData, error: itemError } = await supabase
    .from('work_order_items')
    .select(`
      id,
      serial_number,
      work_order:work_orders(wo_number, product_type, batch_size)
    `)
    .eq('id', itemId)
    .single();

  if (itemError || !itemData) {
    throw new Error('Failed to fetch work order item');
  }

  // Fetch all step executions with measurements
  const { data: executions, error: execError } = await supabase
    .from('step_executions')
    .select(`
      production_step:production_steps(step_number, title_en),
      measurement_values,
      validation_status,
      operator_initials,
      completed_at
    `)
    .eq('work_order_item_id', itemId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true });

  if (execError) {
    throw new Error('Failed to fetch measurements');
  }

  // Fetch batch materials
  const { data: batches, error: batchError } = await supabase
    .from('batch_materials')
    .select('material_type, batch_number, opening_date')
    .eq('work_order_item_id', itemId);

  if (batchError) {
    throw new Error('Failed to fetch batch materials');
  }

  // Fetch sub-assemblies (genealogy)
  const { data: subAssemblies, error: subError } = await supabase
    .from('sub_assemblies')
    .select(`
      component_type,
      child_item:work_order_items!sub_assemblies_child_item_id_fkey(serial_number)
    `)
    .eq('parent_item_id', itemId);

  if (subError) {
    throw new Error('Failed to fetch sub-assemblies');
  }

  // Get current user for "generated_by"
  const { data: { user } } = await supabase.auth.getUser();

  const measurements = (executions || []).map((exec: any) => ({
    step_number: exec.production_step?.step_number || 0,
    step_title: exec.production_step?.title_en || 'Unknown',
    measurement_values: exec.measurement_values || {},
    validation_status: exec.validation_status || 'unknown',
    operator_initials: exec.operator_initials || 'N/A',
    completed_at: exec.completed_at || '',
  }));

  const subAssemblyData = (subAssemblies || []).map((sub: any) => ({
    component_type: sub.component_type,
    child_serial_number: sub.child_item?.serial_number || 'Unknown',
  }));

  return {
    workOrderItem: itemData as any,
    measurements,
    batchMaterials: batches || [],
    subAssemblies: subAssemblyData,
    generatedBy: user?.email || 'System',
  };
}

/**
 * Generate certificate HTML
 */
function generateCertificateHTML(data: CertificateData): string {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Arial', sans-serif;
          padding: 40px;
          background: white;
          color: #000;
        }
        .certificate {
          max-width: 800px;
          margin: 0 auto;
          border: 3px solid #000;
          padding: 30px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
        }
        .header h1 {
          font-size: 32px;
          font-weight: bold;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .header h2 {
          font-size: 20px;
          color: #333;
          margin-bottom: 5px;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 16px;
          font-weight: bold;
          text-transform: uppercase;
          border-bottom: 1px solid #000;
          padding-bottom: 5px;
          margin-bottom: 10px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 8px;
          font-size: 13px;
        }
        .info-label {
          font-weight: bold;
        }
        .info-value {
          color: #333;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 12px;
        }
        th, td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
        th {
          background: #f0f0f0;
          font-weight: bold;
        }
        .status-pass {
          color: #16a34a;
          font-weight: bold;
        }
        .status-fail {
          color: #dc2626;
          font-weight: bold;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #000;
          text-align: center;
          font-size: 11px;
          color: #666;
        }
        .signature-line {
          margin-top: 50px;
          display: flex;
          justify-content: space-around;
        }
        .signature {
          text-align: center;
        }
        .signature-line-border {
          border-top: 1px solid #000;
          width: 200px;
          margin: 0 auto 5px;
        }
      </style>
    </head>
    <body>
      <div class="certificate">
        <div class="header">
          <h1>Quality Certificate</h1>
          <h2>Rhosonics Production Companion</h2>
          <p style="margin-top: 10px; font-size: 14px;">Certificate No: ${data.workOrderItem.serial_number}</p>
        </div>

        <div class="section">
          <div class="section-title">Product Information</div>
          <div class="info-grid">
            <div class="info-label">Serial Number:</div>
            <div class="info-value">${data.workOrderItem.serial_number}</div>

            <div class="info-label">Work Order:</div>
            <div class="info-value">${data.workOrderItem.work_order.wo_number}</div>

            <div class="info-label">Product Type:</div>
            <div class="info-value">${data.workOrderItem.work_order.product_type}</div>

            <div class="info-label">Certificate Date:</div>
            <div class="info-value">${formattedDate}</div>
          </div>
        </div>

        ${data.subAssemblies.length > 0 ? `
        <div class="section">
          <div class="section-title">Component Genealogy</div>
          <table>
            <thead>
              <tr>
                <th>Component Type</th>
                <th>Serial Number</th>
              </tr>
            </thead>
            <tbody>
              ${data.subAssemblies.map(sub => `
                <tr>
                  <td>${sub.component_type}</td>
                  <td>${sub.child_serial_number}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${data.batchMaterials.length > 0 ? `
        <div class="section">
          <div class="section-title">Material Traceability</div>
          <table>
            <thead>
              <tr>
                <th>Material Type</th>
                <th>Batch Number</th>
                ${data.batchMaterials.some(b => b.opening_date) ? '<th>Opening Date</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${data.batchMaterials.map(batch => `
                <tr>
                  <td>${batch.material_type}</td>
                  <td>${batch.batch_number}</td>
                  ${batch.opening_date ? `<td>${new Date(batch.opening_date).toLocaleDateString()}</td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${data.measurements.length > 0 ? `
        <div class="section">
          <div class="section-title">Quality Test Results</div>
          <table>
            <thead>
              <tr>
                <th>Step</th>
                <th>Test Description</th>
                <th>Measurements</th>
                <th>Status</th>
                <th>Operator</th>
              </tr>
            </thead>
            <tbody>
              ${data.measurements.map(m => `
                <tr>
                  <td>${m.step_number}</td>
                  <td>${m.step_title}</td>
                  <td>${Object.entries(m.measurement_values || {})
                    .map(([key, val]) => `${key}: ${val}`)
                    .join(', ') || 'N/A'}</td>
                  <td class="${m.validation_status === 'passed' ? 'status-pass' : m.validation_status === 'failed' ? 'status-fail' : ''}">
                    ${m.validation_status?.toUpperCase() || 'N/A'}
                  </td>
                  <td>${m.operator_initials}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="signature-line">
          <div class="signature">
            <div class="signature-line-border"></div>
            <div>Quality Inspector</div>
          </div>
          <div class="signature">
            <div class="signature-line-border"></div>
            <div>Production Manager</div>
          </div>
        </div>

        <div class="footer">
          <p>This certificate confirms that the above product has passed all required quality checks.</p>
          <p>Generated by: ${data.generatedBy} | ${formattedDate}</p>
          <p><strong>Rhosonics Production Companion v1.0</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Convert HTML to PDF and upload to Supabase Storage
 */
async function generatePDFFromHTML(html: string, serialNumber: string): Promise<string> {
  // Create temporary div for rendering
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '800px';
  document.body.appendChild(tempDiv);

  try {
    // Convert HTML to canvas
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

    // Get PDF as blob
    const pdfBlob = pdf.output('blob');

    // Upload to Supabase Storage
    const fileName = `${serialNumber}_${Date.now()}.pdf`;
    const { data, error } = await supabase.storage
      .from('certificates')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload PDF: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('certificates')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } finally {
    // Clean up
    document.body.removeChild(tempDiv);
  }
}

/**
 * Generate PDF using template or fallback to HTML
 */
async function generatePDFWithTemplate(
  data: CertificateData,
  template: CertificateTemplate | null
): Promise<string> {
  if (template) {
    // Use template-based generation
    const templateData = {
      serialNumber: data.workOrderItem.serial_number,
      woNumber: data.workOrderItem.work_order.wo_number,
      productType: data.workOrderItem.work_order.product_type,
      customerName: '', // Would need to fetch from work_order if needed
      externalOrderNumber: '',
      certificateDate: new Date().toLocaleDateString(),
      generatedBy: data.generatedBy,
      generatedDate: new Date().toISOString(),
      measurements: data.measurements.map(m => ({
        name: m.step_title,
        value: Object.values(m.measurement_values || {})[0] || '',
        unit: '',
      })),
      batchMaterials: data.batchMaterials.map(b => ({
        materialType: b.material_type,
        batchNumber: b.batch_number,
      })),
      subAssemblies: data.subAssemblies.map(s => ({
        componentType: s.component_type,
        serialNumber: s.child_serial_number,
      })),
    };

    try {
      const pdfBytes = await fillTemplate(template, templateData);
      
      // Upload to storage
      const fileName = `${data.workOrderItem.serial_number}_${Date.now()}.pdf`;
      const pdfBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const { error } = await supabase.storage
        .from('certificates')
        .upload(fileName, pdfBlob, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('certificates')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (templateError) {
      console.warn('Template generation failed, falling back to HTML:', templateError);
    }
  }

  // Fallback to HTML-based generation
  const html = generateCertificateHTML(data);
  return generatePDFFromHTML(html, data.workOrderItem.serial_number);
}

/**
 * Main function: Generate quality certificate for a work order item
 */
export async function generateQualityCertificate(
  itemId: string
): Promise<{ certificateId: string; pdfUrl: string }> {
  try {
    // 1. Fetch all data
    const data = await fetchCertificateData(itemId);

    // 2. Check for template
    const template = await getTemplateForProduct(data.workOrderItem.work_order.product_type);

    // 3. Generate PDF (template or HTML fallback)
    const pdfUrl = await generatePDFWithTemplate(data, template);

    // 4. Save certificate record to database
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const { data: certificate, error: certError } = await supabase
      .from('quality_certificates')
      .insert({
        work_order_item_id: itemId,
        certificate_data: {
          measurements: data.measurements,
          batch_materials: data.batchMaterials,
          sub_assemblies: data.subAssemblies,
        } as any,
        pdf_url: pdfUrl,
        generated_by: userId,
      } as any)
      .select()
      .single();

    if (certError) {
      throw new Error(`Failed to save certificate: ${certError.message}`);
    }

    // 5. Update work_order_item to mark certificate as generated
    await supabase
      .from('work_order_items')
      .update({ certificate_generated: true })
      .eq('id', itemId);

    // 6. Log activity
    await supabase.from('activity_logs').insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      action: 'generate_certificate',
      entity_type: 'quality_certificate',
      entity_id: certificate.id,
      details: {
        serial_number: data.workOrderItem.serial_number,
        wo_number: data.workOrderItem.work_order.wo_number,
      },
    });

    // 7. Trigger webhook for certificate generation
    await triggerWebhook('certificate_generated', {
      certificate_id: certificate.id,
      work_order_item_id: itemId,
      serial_number: data.workOrderItem.serial_number,
      wo_number: data.workOrderItem.work_order.wo_number,
      product_type: data.workOrderItem.work_order.product_type,
      pdf_url: pdfUrl,
      generated_at: new Date().toISOString(),
    });

    return {
      certificateId: certificate.id,
      pdfUrl,
    };
  } catch (error) {
    console.error('Certificate generation failed:', error);
    throw error;
  }
}
