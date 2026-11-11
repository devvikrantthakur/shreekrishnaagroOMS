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

  const leftX = 55;
  const leftWidth = 275;
  const rightX = 342;
  const rightWidth = 198;

  const companyName = company?.company_name || 'SHREE KRISHNA AGRO PVT. LTD.';
  const companyAddr = company?.address || '';
  const contactParts = [];
  if (company?.phone) contactParts.push(`Phone: ${company.phone}`);
  if (company?.email) contactParts.push(`Email: ${company.email}`);
  const contactLine = contactParts.join(' | ');
  const gstinLine = company?.gstin ? `GSTIN: ${company.gstin}` : '';

  const invoiceTitle =
    invoice.status === 'CANCELLED'
      ? 'CANCELLED INVOICE'
      : invoice.status === 'CREDIT_NOTE'
      ? 'CREDIT NOTE'
      : 'TAX INVOICE';
  const invoiceNumLine = `Invoice #: ${invoice.invoice_number}`;
  const invoiceDateLine = `Date: ${formatDate(invoice.invoice_date)}`;

  // Measure both columns so the green banner expands dynamically and text never overlaps
  doc.font('Helvetica-Bold').fontSize(15);
  let leftContentH = doc.heightOfString(companyName, { width: leftWidth }) + 5;
  doc.font('Helvetica').fontSize(8.5);
  if (companyAddr) leftContentH += doc.heightOfString(companyAddr, { width: leftWidth }) + 3;
  if (contactLine) leftContentH += doc.heightOfString(contactLine, { width: leftWidth }) + 3;
  if (gstinLine) leftContentH += doc.heightOfString(gstinLine, { width: leftWidth });

  doc.font('Helvetica-Bold').fontSize(15);
  let rightContentH = doc.heightOfString(invoiceTitle, { width: rightWidth }) + 6;
  doc.font('Helvetica').fontSize(9.5);
  rightContentH += doc.heightOfString(invoiceNumLine, { width: rightWidth }) + 4;
  rightContentH += doc.heightOfString(invoiceDateLine, { width: rightWidth });

  const bannerTop = 40;
  const bannerPadY = 14;
  const bannerHeight = Math.max(88, Math.ceil(Math.max(leftContentH, rightContentH)) + bannerPadY * 2);

  // Header Banner
  doc.rect(40, bannerTop, 515, bannerHeight).fill('#15803d');

  // Left Column
  let leftY = bannerTop + bannerPadY;
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15);
  doc.text(companyName, leftX, leftY, { width: leftWidth });
  leftY += doc.heightOfString(companyName, { width: leftWidth }) + 5;

  doc.font('Helvetica').fontSize(8.5);
  if (companyAddr) {
    doc.text(companyAddr, leftX, leftY, { width: leftWidth });
    leftY += doc.heightOfString(companyAddr, { width: leftWidth }) + 3;
  }
  if (contactLine) {
    doc.text(contactLine, leftX, leftY, { width: leftWidth });
    leftY += doc.heightOfString(contactLine, { width: leftWidth }) + 3;
  }
  if (gstinLine) {
    doc.text(gstinLine, leftX, leftY, { width: leftWidth });
  }

  // Right Column
  let rightY = bannerTop + bannerPadY;
  doc.font('Helvetica-Bold').fontSize(15);
  doc.text(invoiceTitle, rightX, rightY, { align: 'right', width: rightWidth });
  rightY += doc.heightOfString(invoiceTitle, { width: rightWidth }) + 6;

  doc.font('Helvetica').fontSize(9.5);
  doc.text(invoiceNumLine, rightX, rightY, { align: 'right', width: rightWidth });
  rightY += doc.heightOfString(invoiceNumLine, { width: rightWidth }) + 4;

  doc.text(invoiceDateLine, rightX, rightY, { align: 'right', width: rightWidth });

  doc.fillColor('#111827');

  // Customer & Order Info
  const infoTop = bannerTop + bannerHeight + 18;
  let billedY = infoTop;
  doc.font('Helvetica-Bold').fontSize(10).text('Billed To:', 40, billedY, { width: 240 });
  billedY += 15;
  doc.font('Helvetica').fontSize(9.5);
  const custName = customer?.full_name || 'Customer';
  doc.text(custName, 40, billedY, { width: 240 });
  billedY += doc.heightOfString(custName, { width: 240 }) + 3;
  const custMobile = `Mobile: ${customer?.mobile || '-'}`;
  doc.text(custMobile, 40, billedY, { width: 240 });
  billedY += doc.heightOfString(custMobile, { width: 240 }) + 3;
  const custEmail = `Email: ${customer?.email || '-'}`;
  doc.text(custEmail, 40, billedY, { width: 240 });
  billedY += doc.heightOfString(custEmail, { width: 240 });

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

  let orderY = infoTop;
  doc.font('Helvetica-Bold').fontSize(10).text('Delivery & Order Details:', 295, orderY, { width: 260 });
  orderY += 15;
  doc.font('Helvetica').fontSize(9.5);
  const ordNumLine = `Order #: ${order?.order_number || '-'}`;
  doc.text(ordNumLine, 295, orderY, { width: 260 });
  orderY += doc.heightOfString(ordNumLine, { width: 260 }) + 3;
  const ordStatusLine = `Status: ${invoice.status}`;
  doc.text(ordStatusLine, 295, orderY, { width: 260 });
  orderY += doc.heightOfString(ordStatusLine, { width: 260 }) + 3;
  const ordAddrLine = `Address: ${addrText}`;
  doc.text(ordAddrLine, 295, orderY, { width: 260 });
  orderY += doc.heightOfString(ordAddrLine, { width: 260 });

  // Items Table
  let y = Math.max(billedY, orderY) + 18;
  const drawItemsHeader = () => {
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
  };

  drawItemsHeader();

  items.forEach((item, idx) => {
    doc.font('Helvetica').fontSize(9);
    const nameText = String(item.vegetable_name_snapshot || '');
    const rowHeight = Math.max(20, doc.heightOfString(nameText, { width: 195 }) + 8);
    if (y + rowHeight > 700) {
      doc.addPage();
      y = 50;
      drawItemsHeader();
    }
    doc.text(String(idx + 1), 48, y, { width: 25 });
    doc.text(nameText, 75, y, { width: 195 });
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

    y += rowHeight;
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
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    doc.fillColor('#14532d').font('Helvetica-Bold').fontSize(10).text('Payment Records', 40, y);
    y += 16;
    doc.fillColor('#374151').font('Helvetica').fontSize(8.5);
    for (const p of payments) {
      if (y > 730) {
        doc.addPage();
        y = 50;
        doc.fillColor('#374151').font('Helvetica').fontSize(8.5);
      }
      doc.text(
        `${formatDate(p.payment_date)} | ${p.payment_number} | ${p.payment_method} | ${p.status} | ${formatCurrency(p.amount)}`,
        40,
        y,
        { width: 515 }
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
