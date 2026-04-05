// ===== PDF Receipt Generation (Professional B&W Templates — jsPDF built-in fonts) =====
const ReceiptPDF = {

    // ── Shared header helper ──
    drawHeader(doc, biz, cx, lx, rx, startY) {
        let y = startY;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text((biz.bizName || 'AgriSys').toUpperCase(), cx, y, { align: 'center' });
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        // Use Address as subtitle if available
        const subtitle = biz.address || 'Agricultural Business Management';
        doc.text(subtitle, cx, y, { align: 'center' });
        y += 4;
        doc.text('Phone: ' + (biz.phone || '-'), cx, y, { align: 'center' });
        y += 3;

        // Double rule
        doc.setLineWidth(0.8);
        doc.line(lx, y, rx, y);
        y += 1;
        doc.setLineWidth(0.3);
        doc.line(lx, y, rx, y);
        y += 2;
        return y;
    },

    async getQRCode(text) {
        if (typeof QRCode === 'undefined') return null;
        try {
            return await QRCode.toDataURL(text, { margin: 1, width: 100 });
        } catch (e) {
            console.error('QR code generation failed', e);
            return null;
        }
    },

    // ── Shared payment watermark ──
    drawWatermark(doc, data, cx, lx, startY) {
        if (data.paymentStatus === 'paid' || data.paymentStatus === 'partial') {
            doc.saveGraphicsState();
            const gState = doc.GState({ opacity: 0.08 });
            doc.setGState(gState);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(56);
            doc.setTextColor(0, 0, 0);
            const wText = data.paymentStatus === 'paid' ? 'PAID' : 'PARTIAL';
            doc.text(wText, cx, 115, { align: 'center', angle: 35 });
            doc.restoreGraphicsState();
            doc.setTextColor(0);

            const stampColor = data.paymentStatus === 'paid' ? [0, 120, 0] : [180, 100, 0];
            doc.setDrawColor(...stampColor);
            doc.setTextColor(...stampColor);
            doc.setLineWidth(0.8);
            const stampW = data.paymentStatus === 'paid' ? 22 : 32;
            doc.roundedRect(lx, startY - 4, stampW, 9, 1, 1, 'S');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text(data.paymentStatus === 'paid' ? 'PAID' : 'PARTIAL', lx + 2.5, startY + 3);
            doc.setDrawColor(0);
            doc.setTextColor(0);
        }
    },

    // ── Info table helper ──
    drawInfoRow(doc, lx, rx, y, label, value, boldValue) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(label, lx, y);
        doc.setFont('helvetica', boldValue ? 'bold' : 'normal');
        doc.setFontSize(boldValue ? 9 : 8.5);
        doc.text(String(value), lx + 25, y);
        return y + 4.5;
    },

    // ── Data row helper ──
    drawDataRow(doc, lx, rx, y, label, value, isBold) {
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setFontSize(8.5);
        doc.text(label, lx + 2, y);
        doc.text(value, rx - 2, y, { align: 'right' });
        return y + 4.5;
    },

    // ── Signatures helper ──
    drawSignatures(doc, lx, rx, y, leftLabel, rightLabel) {
        doc.setLineWidth(0.3);
        doc.line(lx, y, lx + 35, y);
        doc.line(rx - 35, y, rx, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text(leftLabel, lx + 17, y, { align: 'center' });
        doc.text(rightLabel, rx - 17, y, { align: 'center' });
        return y;
    },

    // =================== PURCHASE RECEIPT ===================
    async generatePurchase(data, id) {
        try {
            Utils.showLoading('Generating Purchase PDF...');
            if (!data && id) data = await DB.get('purchases', id);
            if (!data) { Utils.hideLoading(); Utils.showToast('Receipt not found', 'error'); return; }
            const biz = await Settings.getBusiness();
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            const qrText = `AgriSys Purchase\nID: ${data.id}\nDate: ${data.date}\nFarmer: ${data.farmerName}\nNet Payable: PKR ${data.netPayableAmount || data.amount}`;
            const qrImage = await this.getQRCode(qrText);

            this.drawPurchaseCopy(doc, data, biz, 3, 'CUSTOMER COPY', qrImage);
            // Center divider (dashed)
            doc.setLineWidth(0.2);
            doc.setDrawColor(150);
            doc.setLineDashPattern([2, 2], 0);
            doc.line(148.5, 5, 148.5, 205);
            doc.setLineDashPattern([], 0);
            doc.setDrawColor(0);
            this.drawPurchaseCopy(doc, data, biz, 152, 'SHOP COPY', qrImage);

            doc.save('Purchase_' + data.id + '.pdf');
            Utils.hideLoading();
            Utils.showToast('PDF generated!');
        } catch (err) {
            Utils.hideLoading();
            console.error('PDF error:', err);
            Utils.showToast('PDF error: ' + err.message, 'error');
        }
    },

    drawPurchaseCopy(doc, data, biz, startX, copyLabel, qrImage) {
        const W = 142, M = 6;
        const x = startX;
        const lx = x + M;
        const rx = x + W - M;
        const cx = x + W / 2;
        const cw = W - M * 2;

        // Copy label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(120);
        doc.text(copyLabel, cx, 5, { align: 'center' });
        doc.setTextColor(0);

        let y = 8;

        // Watermark
        this.drawWatermark(doc, data, cx, lx, y);

        // Header
        y = this.drawHeader(doc, biz, cx, lx, rx, y);

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('PURCHASE RECEIPT', cx, y + 3, { align: 'center' });
        y += 7;

        // Thin separator
        doc.setLineWidth(0.15);
        doc.line(lx, y, rx, y);
        y += 4;

        // Receipt Info
        y = this.drawInfoRow(doc, lx, rx, y, 'Receipt No:', data.id, true);
        y = this.drawInfoRow(doc, lx, rx, y, 'Farmer:', data.farmerName, true);
        y = this.drawInfoRow(doc, lx, rx, y, 'Date:', Utils.formatDate(data.date));
        y = this.drawInfoRow(doc, lx, rx, y, 'Crop:', data.crop);
        y = this.drawInfoRow(doc, lx, rx, y, 'Method:', data.method === 'scale' ? 'Scale Weight' : 'Bags Count');

        y += 1;
        doc.setLineWidth(0.15);
        doc.line(lx, y, rx, y);
        y += 4;

        // ═══ WEIGHT BREAKDOWN ═══
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(80);
        doc.text('WEIGHT BREAKDOWN', lx, y);
        doc.setTextColor(0);
        y += 5;

        y = this.drawDataRow(doc, lx, rx, y, 'Gross Weight', Utils.formatNum(data.grossWeight, 2) + ' KG');
        
        if (data.bardanaTotal > 0) {
            y = this.drawDataRow(doc, lx, rx, y, '  Less: Bardana (' + Utils.formatNum(data.bardanaPerBag, 1) + '/bag)', '- ' + Utils.formatNum(data.bardanaTotal, 2) + ' KG');
        }
        if (data.labourTotal > 0) {
            y = this.drawDataRow(doc, lx, rx, y, '  Less: Labour (' + Utils.formatNum(data.labourPerBag, 1) + '/bag)', '- ' + Utils.formatNum(data.labourTotal, 2) + ' KG');
        }

        if (data.additionalDeductions) {
            data.additionalDeductions.forEach(d => {
                if (d.unit !== 'pkr') {
                    const val = d.totalKg || d.amount || 0;
                    if (val > 0) {
                        y = this.drawDataRow(doc, lx, rx, y, '  Less: ' + (d.name || 'Deduction'), '- ' + Utils.formatNum(val, 2) + ' KG');
                    }
                }
            });
        }

        doc.setLineWidth(0.15);
        doc.line(lx + 2, y - 1, rx - 2, y - 1);
        y += 3;

        y = this.drawDataRow(doc, lx, rx, y, 'Net Weight', Utils.formatNum(data.netWeight, 2) + ' KG', true);
        y = this.drawDataRow(doc, lx, rx, y, 'Bags / Maund', Utils.formatNum(data.bagsCount || 0, 2) + ' bags  |  ' + Utils.formatNum(data.netMn, 2) + ' Mn');

        y += 2;
        doc.setLineWidth(0.15);
        doc.line(lx, y, rx, y);
        y += 4;

        // ═══ AMOUNT CALCULATION ═══
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(80);
        doc.text('AMOUNT CALCULATION', lx, y);
        doc.setTextColor(0);
        y += 5;

        y = this.drawDataRow(doc, lx, rx, y, 'Rate Per Maund', 'PKR ' + Utils.formatPKR(data.rate));
        y = this.drawDataRow(doc, lx, rx, y, Utils.formatNum(data.netMn, 2) + ' Mn x PKR ' + Utils.formatPKR(data.rate), 'PKR ' + Utils.formatPKR(data.amount));

        if (data.totalPkrDeductions > 0) {
            y = this.drawDataRow(doc, lx, rx, y, '  Less: PKR Deductions', '- PKR ' + Utils.formatPKR(data.totalPkrDeductions));
            // List individual PKR deductions
            if (data.additionalDeductions) {
                data.additionalDeductions.forEach(d => {
                    if (d.unit === 'pkr' && d.amount > 0) {
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(7);
                        doc.text('    ' + (d.name || 'Deduction') + ': PKR ' + Utils.formatPKR(d.amount), lx + 4, y);
                        y += 3.5;
                    }
                });
            }
        }

        // Double line
        doc.setLineWidth(0.4);
        doc.line(lx + 2, y, rx - 2, y);
        y += 1;
        doc.line(lx + 2, y, rx - 2, y);
        y += 5;

        // ═══ NET PAYABLE ═══
        const totalPayable = data.netPayableAmount || data.amount || 0;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('NET PAYABLE AMOUNT', lx + 2, y);
        doc.setFontSize(14);
        doc.text('PKR ' + Utils.formatPKR(totalPayable), rx - 2, y, { align: 'right' });
        y += 6;

        // Payment summary
        const paid = data.amountPaid || 0;
        const balance = totalPayable - paid;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);

        // Draw payment info box
        doc.setLineWidth(0.15);
        doc.rect(lx + 2, y - 2, cw - 4, paid > 0 ? 16 : 8, 'S');
        y += 2;

        if (paid > 0) {
            doc.text('Total Payable:', lx + 4, y);
            doc.text('PKR ' + Utils.formatPKR(totalPayable), rx - 4, y, { align: 'right' });
            y += 4;
            doc.text('Amount Paid:', lx + 4, y);
            doc.text('PKR ' + Utils.formatPKR(paid), rx - 4, y, { align: 'right' });
            y += 1;
            doc.setLineWidth(0.15);
            doc.line(lx + 4, y, rx - 4, y);
            y += 4;
            doc.setFont('helvetica', 'bold');
            doc.text('Balance Due:', lx + 4, y);
            doc.text('PKR ' + Utils.formatPKR(balance), rx - 4, y, { align: 'right' });
            y += 5;
        } else {
            doc.text('Payment Status: PENDING', lx + 4, y);
            doc.setFont('helvetica', 'bold');
            doc.text('Balance Due: PKR ' + Utils.formatPKR(balance), rx - 4, y, { align: 'right' });
            y += 7;
        }

        y += 3;
        doc.setLineWidth(0.1);
        doc.line(lx, y, rx, y);

        // Signatures
        y += 10;
        y = this.drawSignatures(doc, lx, rx, y, 'Farmer Signature', 'Authorized Signature');

        // Footer box
        y += 5;
        const footerH = data.notes ? 16 : 10;
        doc.setDrawColor(180);
        doc.setLineWidth(0.2);
        doc.rect(lx, y, cw, footerH, 'S');
        doc.setDrawColor(0);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(5.5);
        doc.setTextColor(100);
        doc.text('Per Bag: ' + Utils.formatNum(data.perBagWeight, 0) + ' KG  |  Bardana/bag: ' + Utils.formatNum(data.bardanaPerBag || 0, 1) + '  |  Labour/bag: ' + Utils.formatNum(data.labourPerBag || 0, 1), lx + 2, y + 3.5);
        doc.text('Generated: ' + new Date().toLocaleString(), lx + 2, y + 7);
        if (data.notes) {
            doc.text('Notes: ' + data.notes.substring(0, 70), lx + 2, y + 10.5);
        }
        
        if (qrImage) {
            doc.addImage(qrImage, 'PNG', rx - 18, y + 1, footerH - 2, footerH - 2);
        }

        doc.setTextColor(0);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(biz.bizName || 'AGRISYS', cx, y + footerH + 3, { align: 'center' });
    },

    // =================== SALE RECEIPT ===================
    async generateSale(data, id) {
        try {
            Utils.showLoading('Generating Sale PDF...');
            if (!data && id) data = await DB.get('sales', id);
            if (!data) { Utils.hideLoading(); Utils.showToast('Receipt not found', 'error'); return; }
            const biz = await Settings.getBusiness();
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            const qrText = `AgriSys Sale\nID: ${data.id}\nDate: ${data.date}\nBuyer: ${data.buyerName}\nNet Amount: PKR ${data.amount}`;
            const qrImage = await this.getQRCode(qrText);

            this.drawSaleCopy(doc, data, biz, 3, 'BUYER COPY', qrImage);
            // Center divider
            doc.setLineWidth(0.2);
            doc.setDrawColor(150);
            doc.setLineDashPattern([2, 2], 0);
            doc.line(148.5, 5, 148.5, 205);
            doc.setLineDashPattern([], 0);
            doc.setDrawColor(0);
            this.drawSaleCopy(doc, data, biz, 152, 'SHOP COPY', qrImage);

            doc.save('Sale_' + data.id + '.pdf');
            Utils.hideLoading();
            Utils.showToast('Sale PDF generated!');
        } catch (err) {
            Utils.hideLoading();
            console.error('Sale PDF error:', err);
            Utils.showToast('PDF error: ' + err.message, 'error');
        }
    },

    drawSaleCopy(doc, data, biz, startX, copyLabel, qrImage) {
        const W = 142, M = 6;
        const x = startX, lx = x + M, rx = x + W - M, cx = x + W / 2, cw = W - M * 2;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(120);
        doc.text(copyLabel, cx, 5, { align: 'center' });
        doc.setTextColor(0);

        let y = 8;

        // Watermark
        this.drawWatermark(doc, data, cx, lx, y);

        // Header
        y = this.drawHeader(doc, biz, cx, lx, rx, y);

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('SALE RECEIPT', cx, y + 3, { align: 'center' });
        y += 7;

        doc.setLineWidth(0.15);
        doc.line(lx, y, rx, y);
        y += 4;

        // Receipt Info
        y = this.drawInfoRow(doc, lx, rx, y, 'Receipt No:', data.id, true);
        y = this.drawInfoRow(doc, lx, rx, y, 'Buyer:', data.buyerName, true);
        y = this.drawInfoRow(doc, lx, rx, y, 'Date:', Utils.formatDate(data.date));
        y = this.drawInfoRow(doc, lx, rx, y, 'Crop:', data.crop);

        y += 1;
        doc.setLineWidth(0.15);
        doc.line(lx, y, rx, y);
        y += 4;

        // ═══ WEIGHT BREAKDOWN ═══
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(80);
        doc.text('WEIGHT BREAKDOWN', lx, y);
        doc.setTextColor(0);
        y += 5;

        y = this.drawDataRow(doc, lx, rx, y, 'Gross Weight', Utils.formatNum(data.grossWeight, 2) + ' KG');

        // Itemized KG deductions
        const deds = data.deductions || data.additionalDeductions || [];
        deds.forEach(d => {
            if (d.unit === 'kg' && d.amount > 0) {
                y = this.drawDataRow(doc, lx, rx, y, '  Less: ' + (d.name || 'Deduction'), '- ' + Utils.formatNum(d.amount, 2) + ' KG');
            }
        });

        if (data.kgDeductions > 0 && deds.length === 0) {
            y = this.drawDataRow(doc, lx, rx, y, '  Less: Deductions', '- ' + Utils.formatNum(data.kgDeductions, 2) + ' KG');
        }

        doc.setLineWidth(0.15);
        doc.line(lx + 2, y - 1, rx - 2, y - 1);
        y += 3;

        y = this.drawDataRow(doc, lx, rx, y, 'Net Weight', Utils.formatNum(data.netWeight, 2) + ' KG', true);
        const bags = data.grossWeight / (data.perBag || data.perBagWeight || 100);
        y = this.drawDataRow(doc, lx, rx, y, 'Bags / Maund', Utils.formatNum(bags || 0, 2) + ' bags  |  ' + Utils.formatNum(data.netMn, 2) + ' Mn');

        y += 2;
        doc.setLineWidth(0.15);
        doc.line(lx, y, rx, y);
        y += 4;

        // ═══ AMOUNT CALCULATION ═══
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(80);
        doc.text('AMOUNT CALCULATION', lx, y);
        doc.setTextColor(0);
        y += 5;

        y = this.drawDataRow(doc, lx, rx, y, 'Rate Per Maund', 'PKR ' + Utils.formatPKR(data.rate));

        // Correct net amount calculation: netMn × rate
        const rawAmount = data.netMn * data.rate;
        y = this.drawDataRow(doc, lx, rx, y, Utils.formatNum(data.netMn, 2) + ' Mn x PKR ' + Utils.formatPKR(data.rate), 'PKR ' + Utils.formatPKR(rawAmount));

        // PKR deductions
        let totalPkrDed = 0;
        deds.forEach(d => {
            if (d.unit === 'pkr' && d.amount > 0) {
                totalPkrDed += d.amount;
                y = this.drawDataRow(doc, lx, rx, y, '  Less: ' + (d.name || 'Deduction'), '- PKR ' + Utils.formatPKR(d.amount));
            }
        });

        // Double line
        doc.setLineWidth(0.4);
        doc.line(lx + 2, y, rx - 2, y);
        y += 1;
        doc.line(lx + 2, y, rx - 2, y);
        y += 5;

        // Net Amount - use the actual stored amount which accounts for deductions
        const netAmount = data.amount || Math.max(0, rawAmount - totalPkrDed);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('NET SALE AMOUNT', lx + 2, y);
        doc.setFontSize(14);
        doc.text('PKR ' + Utils.formatPKR(netAmount), rx - 2, y, { align: 'right' });
        y += 6;

        // Payment info box
        const rcvd = data.amountReceived || 0;
        const balance = netAmount - rcvd;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setLineWidth(0.15);
        doc.rect(lx + 2, y - 2, cw - 4, rcvd > 0 ? 16 : 8, 'S');
        y += 2;

        if (rcvd > 0) {
            doc.text('Total Amount:', lx + 4, y);
            doc.text('PKR ' + Utils.formatPKR(netAmount), rx - 4, y, { align: 'right' });
            y += 4;
            doc.text('Amount Received:', lx + 4, y);
            doc.text('PKR ' + Utils.formatPKR(rcvd), rx - 4, y, { align: 'right' });
            y += 1;
            doc.setLineWidth(0.15);
            doc.line(lx + 4, y, rx - 4, y);
            y += 4;
            doc.setFont('helvetica', 'bold');
            doc.text('Balance Receivable:', lx + 4, y);
            doc.text('PKR ' + Utils.formatPKR(balance), rx - 4, y, { align: 'right' });
            y += 5;
        } else {
            doc.text('Payment Status: PENDING', lx + 4, y);
            doc.setFont('helvetica', 'bold');
            doc.text('Balance Receivable: PKR ' + Utils.formatPKR(balance), rx - 4, y, { align: 'right' });
            y += 7;
        }

        y += 3;
        doc.setLineWidth(0.1);
        doc.line(lx, y, rx, y);

        // Signatures
        y += 10;
        y = this.drawSignatures(doc, lx, rx, y, 'Buyer Signature', 'Authorized Signature');

        // Footer
        y += 5;
        const footerH = data.notes ? 16 : 10;
        doc.setDrawColor(180);
        doc.setLineWidth(0.2);
        doc.rect(lx, y, cw, footerH, 'S');
        doc.setDrawColor(0);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(5.5);
        doc.setTextColor(100);
        doc.text('Per Bag: ' + Utils.formatNum(data.perBag || data.perBagWeight || 100, 0) + ' KG', lx + 2, y + 3.5);
        doc.text('Generated: ' + new Date().toLocaleString(), lx + 2, y + 7);
        if (data.notes) {
            doc.text('Notes: ' + data.notes.substring(0, 70), lx + 2, y + 10.5);
        }
        
        if (qrImage) {
            doc.addImage(qrImage, 'PNG', rx - 18, y + 1, footerH - 2, footerH - 2);
        }
        
        doc.setTextColor(0);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(biz.bizName || 'AGRISYS', cx, y + footerH + 3, { align: 'center' });
    },

    // =================== FARMER LEDGER ===================
    async generateFarmerLedger(farmerId) {
        try {
            Utils.showLoading('Generating Farmer Ledger...');
            const farmer = await DB.get('farmers', farmerId);
            if (!farmer) { Utils.hideLoading(); Utils.showToast('Farmer not found', 'error'); return; }

            const biz = await Settings.getBusiness();
            const allPurchases = await DB.getAll('purchases');
            const allPayments = await DB.getAll('purchase_payments');

            const fNameLower = farmer.name.toLowerCase();
            const fp = allPurchases.filter(p => p.farmerName.toLowerCase() === fNameLower);
            const payments = allPayments.filter(p => p.farmerName.toLowerCase() === fNameLower);

            let transactions = [];

            fp.forEach(p => {
                const totalBill = p.netPayableAmount || p.amount || 0;
                transactions.push({
                    date: new Date(p.date || p.createdAt),
                    dateStr: Utils.formatDate(p.date),
                    desc: `Purchase #${p.id} - ${p.crop} (${Utils.formatNum(p.netWeight, 2)} KG @ PKR ${Utils.formatPKR(p.rate)}/Mn)`,
                    payable: totalBill,
                    paid: 0
                });

                const laterPayments = payments.filter(pay => pay.purchaseId === p.id).reduce((s, pay) => s + (pay.amount || 0), 0);
                const initialPaid = (p.amountPaid || 0) - laterPayments;
                
                if (initialPaid > 0) {
                    transactions.push({
                        date: new Date(p.date || p.createdAt),
                        dateStr: Utils.formatDate(p.date),
                        desc: `  > Advance Payment for #${p.id}`,
                        payable: 0,
                        paid: initialPaid
                    });
                }
            });

            payments.forEach(pay => {
                transactions.push({
                    date: new Date(pay.date || pay.createdAt),
                    dateStr: Utils.formatDate(pay.date),
                    desc: `Payment [${pay.mode || 'Cash'}] for #${pay.purchaseId}` + (pay.reference ? ` (Ref: ${pay.reference})` : ''),
                    payable: 0,
                    paid: pay.amount || 0
                });
            });

            transactions.sort((a, b) => a.date - b.date);

            let balance = 0;
            let totalPayable = 0;
            let totalPaid = 0;
            const tableBody = transactions.map(t => {
                balance += t.payable;
                balance -= t.paid;
                totalPayable += t.payable;
                totalPaid += t.paid;
                return [
                    t.dateStr,
                    t.desc,
                    t.payable > 0 ? 'PKR ' + Utils.formatPKR(t.payable) : '',
                    t.paid > 0 ? 'PKR ' + Utils.formatPKR(t.paid) : '',
                    'PKR ' + Utils.formatPKR(balance)
                ];
            });

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            // Professional Header
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text((biz.bizName || 'AgriSys').toUpperCase(), 105, 15, { align: 'center' });
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(biz.address || 'Agricultural Business Management', 105, 21, { align: 'center' });
            doc.text('Phone: ' + (biz.phone || '-'), 105, 26, { align: 'center' });

            doc.setLineWidth(0.8); doc.line(15, 29, 195, 29);
            doc.setLineWidth(0.3); doc.line(15, 30, 195, 30);

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('FARMER STATEMENT OF ACCOUNT', 105, 37, { align: 'center' });

            doc.setLineWidth(0.15); doc.line(15, 40, 195, 40);

            // Farmer Info Box
            doc.setFillColor(245, 245, 245);
            doc.rect(15, 43, 180, 18, 'F');
            doc.setLineWidth(0.15);
            doc.rect(15, 43, 180, 18, 'S');

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Account:', 18, 50);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.text(farmer.name.toUpperCase(), 38, 50);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Phone:', 18, 56);
            doc.setFont('helvetica', 'normal');
            doc.text(farmer.phone || 'N/A', 32, 56);

            doc.setFont('helvetica', 'bold');
            doc.text('Statement Date:', 130, 50);
            doc.setFont('helvetica', 'normal');
            doc.text(Utils.formatDate(new Date().toISOString()), 163, 50);

            doc.setFont('helvetica', 'bold');
            doc.text('Total Purchases:', 130, 56);
            doc.setFont('helvetica', 'normal');
            doc.text(String(fp.length), 163, 56);

            // Ledger Table
            doc.autoTable({
                startY: 66,
                head: [['Date', 'Description', 'Payable (+)', 'Paid (-)', 'Balance']],
                body: tableBody,
                foot: [[
                    '', 'TOTALS',
                    'PKR ' + Utils.formatPKR(totalPayable),
                    'PKR ' + Utils.formatPKR(totalPaid),
                    'PKR ' + Utils.formatPKR(balance)
                ]],
                theme: 'grid',
                headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', fontSize: 8 },
                styles: { fontSize: 7.5, font: 'helvetica', textColor: 20, lineColor: 180, lineWidth: 0.15, cellPadding: 2.5 },
                alternateRowStyles: { fillColor: [250, 250, 250] },
                columnStyles: {
                    0: { cellWidth: 22 },
                    1: { cellWidth: 'auto' },
                    2: { halign: 'right', cellWidth: 28 },
                    3: { halign: 'right', cellWidth: 28 },
                    4: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
                }
            });

            // Final Balance Statement
            const fy = doc.lastAutoTable.finalY + 8;

            // Balance box
            doc.setLineWidth(0.5);
            const balText = balance > 0
                ? `BALANCE DUE: SHOP OWES FARMER  PKR ${Utils.formatPKR(balance)}`
                : balance < 0
                    ? `BALANCE DUE: FARMER OWES SHOP  PKR ${Utils.formatPKR(Math.abs(balance))}  (Advance)`
                    : 'BALANCE CLEARED - ALL ACCOUNTS SETTLED (PKR 0.00)';

            doc.rect(15, fy - 4, 180, 10, 'S');
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(balText, 105, fy + 3, { align: 'center' });

            // Signatures
            const sy = Math.min(fy + 30, 270);
            doc.setLineWidth(0.3);
            doc.line(15, sy, 75, sy);
            doc.line(135, sy, 195, sy);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('Farmer Signature / Stamp', 45, sy + 5, { align: 'center' });
            doc.text('Authorized Signature / Stamp', 165, sy + 5, { align: 'center' });

            doc.save(`Farmer_Ledger_${farmer.name.replace(/\s+/g, '_')}.pdf`);
            Utils.hideLoading();
            Utils.showToast('Ledger PDF generated!');
        } catch (err) {
            Utils.hideLoading();
            console.error('Ledger PDF error:', err);
            Utils.showToast('PDF error: ' + err.message, 'error');
        }
    }
};
