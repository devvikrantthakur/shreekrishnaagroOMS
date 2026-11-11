const PDFDocument = require('pdfkit');

function formatCurrency(val) {
  return `Rs. ${Number(val || 0).toFixed(2)}`;
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function generateInvoicePdf(invoiceData, res) {
  const { invoice, order, items, company, customer, payments } = invoiceData;

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Invoice-${invoice.invoice_number}.pdf"`
  );
  doc.pipe(res);

  // Header Banner
  doc
    .rect(40, 40, 515, 76)
    .fill('#15803d');

  doc
    .fillColor('#ffffff')
    .fontSize(18)
    .font('Helvetica-Bold')
    .text(company?.company_name || 'SHREE KRISHNA AGRO PVT. LTD.', 55, 52);

  doc
    .fontSize(9)
    .font('Helvetica')
    .text(company?.address || '', 55, 75, { width: 320 })
    .text(`Phone: ${company?.phone || ''} | Email: ${company?.email || ''}`, 55, 92)
    .text(company?.gstin ? `GSTIN: ${company.gstin}` : '', 55, 103);

  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(invoice.status === 'CANCELLED' ? 'CANCELLED INVOICE' : 'TAX INVOICE', 380, 54, {
      align: 'right',
      width: 160,
    })
    .fontSize(10)
    .font('Helvetica')
    .text(`Invoice #: ${invoice.invoice_number}`, 380, 78, { align: 'right', width: 160 })
    .text(`Date: ${formatDate(invoice.invoice_date)}`, 380, 93, { align: 'right', width: 160 });

  doc.fillColor('#111827');

  // Customer & Order Info
  const infoTop = 132;
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Billed To:', 40, infoTop)
    .font('Helvetica')
    .fontSize(9.5)
    .text(customer?.full_name || 'Customer', 40, infoTop + 15)
    .text(`Mobile: ${customer?.mobile || '-'}`, 40, infoTop + 29)
    .text(`Email: ${customer?.email || '-'}`, 40, infoTop + 43);

  let addrText = '-';
  if (order?.delivery_address_snapshot) {
    const a =
      typeof order.delivery_address_snapshot === 'string'
        ? JSON.parse(order.delivery_address_snapshot)
        : order.delivery_address_snapshot;
    addrText = [a.address_line1, a.address_line2, a.city, a.state, a.pincode]
      .filter(Boolean)
      .join(', ');
  }

  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Delivery & Order Details:', 300, infoTop)
    .font('Helvetica')
    .fontSize(9.5)
    .text(`Order #: ${order?.order_number || '-'}`, 300, infoTop + 15)
    .text(`Status: ${invoice.status}`, 300, infoTop + 29)
    .text(`Address: ${addrText}`, 300, infoTop + 43, { width: 255 });

  // Items Table
  let y = 215;
  doc.rect(40, y, 515, 22).fill('#f0fdf4');
  doc.fillColor('#14532d').font('Helvetica-Bold').fontSize(9);
  doc.text('#', 48, y + 7, { width: 25 });
  doc.text('Vegetable / Description', 75, y + 7, { width: 195 });
  doc.text('Qty', 275, y + 7, { width: 70, align: 'right' });
  doc.text('Base Qty', 350, y + 7, { width: 65, align: 'right' });
  doc.text('Unit Price', 420, y + 7, { width: 65, align: 'right' });
  doc.text('Total', 490, y + 7, { width: 58, align: 'right' });

  y += 26;
  doc.fillColor('#1f2937').font('Helvetica').fontSize(9);

  items.forEach((item, idx) => {
    if (y > 680) {
      doc.addPage();
      y = 50;
    }
    doc.text(String(idx + 1), 48, y, { width: 25 });
    doc.text(item.vegetable_name_snapshot, 75, y, { width: 195 });
    doc.text(`${Number(item.quantity)} ${item.unit}`, 275, y, { width: 70, align: 'right' });
    doc.text(`${Number(item.base_quantity)} ${item.base_unit}`, 350, y, {
      width: 65,
      align: 'right',
    });
    doc.text(`${formatCurrency(item.base_unit_price)}/${item.base_unit}`, 415, y, {
      width: 70,
      align: 'right',
    });
    doc.text(formatCurrency(item.line_total), 490, y, { width: 58, align: 'right' });

    y += 20;
    doc.moveTo(40, y - 4).lineTo(555, y - 4).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  });

  // Totals Summary
  y += 12;
  if (y > 650) {
    doc.addPage();
    y = 50;
  }

  const summaryX = 350;
  const valX = 465;

  const drawSummaryRow = (label, value, bold = false, color = '#111827') => {
    doc
      .fillColor(color)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(10)
      .text(label, summaryX, y, { width: 110, align: 'left' })
      .text(value, valX, y, { width: 85, align: 'right' });
    y += 18;
  };

  drawSummaryRow('Subtotal:', formatCurrency(invoice.subtotal));
  drawSummaryRow('Discount:', `- ${formatCurrency(invoice.discount_amount)}`);
  drawSummaryRow('Total Amount:', formatCurrency(invoice.total_amount), true);
  drawSummaryRow('Paid Amount:', formatCurrency(invoice.paid_amount), false, '#15803d');
  drawSummaryRow(
    'Balance Due:',
    formatCurrency(invoice.balance_due),
    true,
    Number(invoice.balance_due) > 0 ? '#b91c1c' : '#15803d'
  );

  // Payment History Section
  if (payments && payments.length > 0) {
    y += 16;
    doc.fillColor('#14532d').font('Helvetica-Bold').fontSize(10).text('Payment Records', 40, y);
    y += 16;
    doc.fillColor('#374151').font('Helvetica').fontSize(8.5);
    for (const p of payments) {
      doc.text(
        `${formatDate(p.payment_date)} | ${p.payment_number} | ${p.payment_method} | ${p.status} | ${formatCurrency(p.amount)}`,
        40,
        y
      );
      y += 14;
    }
  }

  // Footer
  doc
    .fillColor('#6b7280')
    .fontSize(8.5)
    .text(
      'Thank you for choosing Shree Krishna Agro Pvt. Ltd. — Fresh Produce Delivered with Care.',
      40,
      765,
      { align: 'center', width: 515 }
    );

  doc.end();
}

function generateReportPdf(title, subtitle, columns, rows, summaryLines, res) {
  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: columns.length > 6 ? 'landscape' : 'portrait' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf"`
  );
  doc.pipe(res);

  const pageWidth = doc.page.width - 72;

  doc.fillColor('#15803d').font('Helvetica-Bold').fontSize(15).text('SHREE KRISHNA AGRO PVT. LTD.', 36, 36);
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(13).text(title, 36, 56);
  doc.fillColor('#4b5563').font('Helvetica').fontSize(9.5).text(subtitle || '', 36, 74);

  let y = 98;
  if (summaryLines && summaryLines.length > 0) {
    doc.rect(36, y, pageWidth, summaryLines.length * 16 + 12).fill('#f0fdf4');
    doc.fillColor('#14532d').font('Helvetica-Bold').fontSize(9.5);
    summaryLines.forEach((line, i) => {
      doc.text(`${line.label}: ${line.value}`, 46, y + 8 + i * 16);
    });
    y += summaryLines.length * 16 + 24;
  }

  const colWidth = pageWidth / columns.length;
  const drawHeader = () => {
    doc.rect(36, y, pageWidth, 20).fill('#166534');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
    columns.forEach((col, i) => {
      doc.text(col.label, 40 + i * colWidth, y + 6, {
        width: colWidth - 8,
        align: col.align || 'left',
      });
    });
    y += 24;
  };

  drawHeader();
  doc.fillColor('#1f2937').font('Helvetica').fontSize(8.5);

  rows.forEach((row) => {
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = 40;
      drawHeader();
      doc.fillColor('#1f2937').font('Helvetica').fontSize(8.5);
    }
    columns.forEach((col, i) => {
      const val = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '';
      doc.text(val, 40 + i * colWidth, y, {
        width: colWidth - 8,
        align: col.align || 'left',
      });
    });
    y += 18;
    doc.moveTo(36, y - 3).lineTo(36 + pageWidth, y - 3).strokeColor('#e5e7eb').lineWidth(0.4).stroke();
  });

  doc.end();
}

module.exports = {
  generateInvoicePdf,
  generateReportPdf,
};
