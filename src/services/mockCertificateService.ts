import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface MockCertificateData {
  serialNumber: string;
  workOrderNumber: string;
  productType: string;
  customerName?: string;
  measurements: Array<{
    stepNumber: number;
    stepTitle: string;
    values: Record<string, string | number>;
    status: 'passed' | 'failed' | 'pending';
    operator: string;
    completedAt: string;
  }>;
  batchMaterials: Array<{
    materialType: string;
    batchNumber: string;
    openingDate?: string;
  }>;
  subAssemblies: Array<{
    componentType: string;
    serialNumber: string;
  }>;
  generatedBy: string;
}

/**
 * Generate sample mock data for testing certificate preview
 */
export function generateMockCertificateData(): MockCertificateData {
  const mockDate = new Date();
  const serialPrefix = ['S', 'Q', 'W', 'X', 'T'][Math.floor(Math.random() * 5)];
  const randomSerial = `${serialPrefix}-${Date.now().toString().slice(-8)}-001`;
  
  return {
    serialNumber: randomSerial,
    workOrderNumber: `WO-${mockDate.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`,
    productType: ['SDM_ECO', 'SENSOR', 'MLA', 'HMI', 'TRANSMITTER'][Math.floor(Math.random() * 5)],
    customerName: 'Sample Customer BV',
    measurements: [
      {
        stepNumber: 1,
        stepTitle: 'Initial Inspection',
        values: { 'Visual Check': 'OK', 'Weight (g)': 245.3 },
        status: 'passed',
        operator: 'MB',
        completedAt: new Date(mockDate.getTime() - 3600000).toISOString(),
      },
      {
        stepNumber: 2,
        stepTitle: 'Calibration Test',
        values: { 'Frequency (Hz)': 1000.5, 'Amplitude (mV)': 2.34, 'Temperature (°C)': 23.1 },
        status: 'passed',
        operator: 'HL',
        completedAt: new Date(mockDate.getTime() - 1800000).toISOString(),
      },
      {
        stepNumber: 3,
        stepTitle: 'Pressure Test',
        values: { 'Max Pressure (bar)': 10.2, 'Hold Time (s)': 300, 'Leak Rate (ml/min)': 0.01 },
        status: 'passed',
        operator: 'AB',
        completedAt: mockDate.toISOString(),
      },
    ],
    batchMaterials: [
      { materialType: 'Epoxy', batchNumber: 'EPX-2024-0892', openingDate: '2024-11-15' },
      { materialType: 'Piezo Element', batchNumber: 'PZE-2024-1203' },
      { materialType: 'PCB Assembly', batchNumber: 'PCB-A-2024-0456' },
    ],
    subAssemblies: [
      { componentType: 'SENSOR', serialNumber: 'Q-20241201-001' },
      { componentType: 'MLA', serialNumber: 'W-20241201-001' },
      { componentType: 'HMI', serialNumber: 'X-20241201-001' },
    ],
    generatedBy: 'Demo User',
  };
}

/**
 * Generate certificate HTML from data (shared logic)
 */
export function generateCertificateHTML(data: MockCertificateData): string {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formatProductType = (type: string) => type.replace(/_/g, ' ');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', 'Arial', sans-serif;
          padding: 40px;
          background: white;
          color: #1a1a1a;
        }
        .certificate {
          max-width: 800px;
          margin: 0 auto;
          border: 3px solid #1a1a1a;
          padding: 32px;
        }
        .header {
          text-align: center;
          margin-bottom: 32px;
          border-bottom: 2px solid #1a1a1a;
          padding-bottom: 24px;
        }
        .logo {
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: lowercase;
          color: #22c55e;
          margin-bottom: 8px;
        }
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .header .cert-number {
          font-size: 14px;
          color: #666;
          font-family: monospace;
        }
        .section {
          margin-bottom: 24px;
        }
        .section-title {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          border-bottom: 1px solid #1a1a1a;
          padding-bottom: 6px;
          margin-bottom: 12px;
          color: #22c55e;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 6px 16px;
          font-size: 13px;
        }
        .info-label {
          font-weight: 600;
          color: #444;
        }
        .info-value {
          color: #1a1a1a;
          font-family: monospace;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 11px;
        }
        th, td {
          border: 1px solid #1a1a1a;
          padding: 8px 10px;
          text-align: left;
        }
        th {
          background: #f5f5f5;
          font-weight: 600;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .status-passed {
          color: #16a34a;
          font-weight: 700;
        }
        .status-failed {
          color: #dc2626;
          font-weight: 700;
        }
        .status-pending {
          color: #ca8a04;
          font-weight: 600;
        }
        .footer {
          margin-top: 40px;
          padding-top: 24px;
          border-top: 2px solid #1a1a1a;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
        .signature-line {
          margin-top: 48px;
          display: flex;
          justify-content: space-around;
        }
        .signature {
          text-align: center;
        }
        .signature-line-border {
          border-top: 1px solid #1a1a1a;
          width: 180px;
          margin: 0 auto 6px;
        }
        .signature-label {
          font-size: 11px;
          color: #444;
        }
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 80px;
          color: rgba(200, 200, 200, 0.15);
          font-weight: bold;
          pointer-events: none;
          z-index: 0;
        }
      </style>
    </head>
    <body>
      <div class="certificate">
        <div class="header">
          <div class="logo">rhosonics</div>
          <h1>Quality Certificate</h1>
          <div class="cert-number">Certificate No: ${data.serialNumber}</div>
        </div>

        <div class="section">
          <div class="section-title">Product Information</div>
          <div class="info-grid">
            <div class="info-label">Serial Number:</div>
            <div class="info-value">${data.serialNumber}</div>

            <div class="info-label">Work Order:</div>
            <div class="info-value">${data.workOrderNumber}</div>

            <div class="info-label">Product Type:</div>
            <div class="info-value">${formatProductType(data.productType)}</div>

            ${data.customerName ? `
            <div class="info-label">Customer:</div>
            <div class="info-value">${data.customerName}</div>
            ` : ''}

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
                  <td>${formatProductType(sub.componentType)}</td>
                  <td style="font-family: monospace;">${sub.serialNumber}</td>
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
                ${data.batchMaterials.some(b => b.openingDate) ? '<th>Opening Date</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${data.batchMaterials.map(batch => `
                <tr>
                  <td>${batch.materialType}</td>
                  <td style="font-family: monospace;">${batch.batchNumber}</td>
                  ${batch.openingDate ? `<td>${new Date(batch.openingDate).toLocaleDateString()}</td>` : data.batchMaterials.some(b => b.openingDate) ? '<td>-</td>' : ''}
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
                <th>Test</th>
                <th>Measurements</th>
                <th>Status</th>
                <th>Operator</th>
              </tr>
            </thead>
            <tbody>
              ${data.measurements.map(m => `
                <tr>
                  <td style="text-align: center; font-weight: 600;">${m.stepNumber}</td>
                  <td>${m.stepTitle}</td>
                  <td style="font-family: monospace; font-size: 10px;">${Object.entries(m.values || {})
                    .map(([key, val]) => `${key}: ${val}`)
                    .join('<br>')}</td>
                  <td class="status-${m.status}">
                    ${m.status.toUpperCase()}
                  </td>
                  <td style="text-align: center; font-weight: 600;">${m.operator}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="signature-line">
          <div class="signature">
            <div class="signature-line-border"></div>
            <div class="signature-label">Quality Inspector</div>
          </div>
          <div class="signature">
            <div class="signature-line-border"></div>
            <div class="signature-label">Production Manager</div>
          </div>
        </div>

        <div class="footer">
          <p>This certificate confirms that the above product has passed all required quality checks.</p>
          <p style="margin-top: 8px;">Generated by: ${data.generatedBy} | ${formattedDate}</p>
          <p style="margin-top: 4px; font-weight: 600;">Rhosonics Production Companion</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Preview certificate in a new window
 */
export function previewCertificate(data: MockCertificateData): void {
  const html = generateCertificateHTML(data);
  const previewWindow = window.open('', '_blank');
  if (previewWindow) {
    previewWindow.document.write(html);
    previewWindow.document.close();
  }
}

/**
 * Generate PDF from certificate data
 */
export async function generateCertificatePDF(data: MockCertificateData): Promise<Blob> {
  const html = generateCertificateHTML(data);
  
  // Create temporary div for rendering
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '800px';
  document.body.appendChild(tempDiv);

  try {
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

    return pdf.output('blob');
  } finally {
    document.body.removeChild(tempDiv);
  }
}

/**
 * Download certificate as PDF
 */
export async function downloadCertificatePDF(data: MockCertificateData): Promise<void> {
  const blob = await generateCertificatePDF(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Certificate_${data.serialNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
