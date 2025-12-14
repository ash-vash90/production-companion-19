import QRCodeLib from 'qrcode';
import { supabase } from '@/integrations/supabase/client';

interface PrintLabelOptions {
  serialNumber: string;
  workOrderNumber?: string;
  productType?: string;
  operatorInitials?: string;
  userId?: string;
}

export const printWorkOrderLabel = async ({
  serialNumber,
  workOrderNumber,
  productType,
  operatorInitials,
  userId,
}: PrintLabelOptions) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.toLocaleString('en', { month: 'short' }).toUpperCase();
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year} / ${month} / ${day}`;

  const qrData = JSON.stringify({
    serial: serialNumber,
    wo: workOrderNumber,
    product: productType || '',
    date: now.toISOString().split('T')[0],
  });
  const qrCodeDataUrl = await QRCodeLib.toDataURL(qrData, { width: 120, margin: 1 });

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>Label: ${serialNumber}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@500;600;700&family=Libre+Barcode+128&display=swap" rel="stylesheet">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            @page {
              size: 4in 3in;
              margin: 0;
            }
            body {
              font-family: 'Instrument Sans', sans-serif;
              background: white;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 3in;
              width: 4in;
            }
            .label {
              border: 4px solid #000;
              padding: 16px;
              width: 100%;
              height: 100%;
              text-align: center;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .date {
              font-size: 11px;
              font-weight: 600;
              letter-spacing: 0.3px;
              text-transform: uppercase;
            }
            .product {
              font-size: 16px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .serial {
              font-size: 32px;
              font-weight: 700;
              letter-spacing: 2px;
              margin: 8px 0;
            }
            .barcode {
              font-family: 'Libre Barcode 128', cursive;
              font-size: 56px;
              line-height: 1;
              letter-spacing: 0;
              margin: 4px 0;
            }
            .codes-container {
              display: flex;
              justify-content: center;
              align-items: center;
              gap: 12px;
              margin: 8px 0;
            }
            .qr-code {
              width: 80px;
              height: 80px;
            }
            .info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 12px;
              font-weight: 600;
              padding-top: 8px;
              border-top: 3px solid #000;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="date">${dateStr}</div>
            <div class="product">${productType || ''}</div>
            <div class="serial">${serialNumber}</div>
            <div class="codes-container">
              <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code" />
              <div class="barcode">${serialNumber}</div>
            </div>
            <div class="info">
              <span>WO: ${workOrderNumber || ''}</span>
              ${operatorInitials ? `<span>OP: ${operatorInitials}</span>` : '<span></span>'}
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                setTimeout(() => window.close(), 500);
              }, 100);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();

    supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'print_label',
      entity_type: 'work_order_item',
      details: { serial_number: serialNumber, wo_number: workOrderNumber, operator: operatorInitials },
    }).then(({ error }) => {
      if (error) console.error('Failed to log print activity:', error);
    });
  }
};
