// ===== Buyers Module =====
const Buyers = {
    async init() {},

    async ensureBuyer(name) {
        if (!name) return;
        const all = await DB.getAll('buyers');
        const exists = all.find(b => b.name.toLowerCase() === name.toLowerCase());
        if (!exists) {
            await DB.put('buyers', { id: Utils.generateId(), name, phone: '', address: '', notes: '', createdAt: new Date().toISOString() });
        }
    },

    async render() {
        const buyers = await DB.getAll('buyers');
        const sales = await DB.getAll('sales');
        const search = (document.getElementById('b-search').value || '').toLowerCase();

        const filtered = buyers.filter(b => !search || b.name.toLowerCase().includes(search) || (b.phone || '').includes(search));

        const tbody = document.getElementById('buyers-tbody');
        const empty = document.getElementById('buyers-empty');

        if (filtered.length === 0) { tbody.innerHTML = ''; empty.style.display = ''; return; }
        empty.style.display = 'none';

        tbody.innerHTML = filtered.map(b => {
            const bs = sales.filter(s => s.buyerName.toLowerCase() === b.name.toLowerCase());
            const totalAmt = bs.reduce((s, x) => s + (x.amount || 0), 0);
            const totalRcvd = bs.reduce((s, x) => s + (x.amountReceived || 0), 0);
            const balance = totalAmt - totalRcvd;
            return `<tr>
                <td class="font-bold">${Utils.highlightText(b.name, search)}</td>
                <td>${Utils.highlightText(b.phone || '-', search)}</td>
                <td class="text-center">${bs.length}</td>
                <td class="text-right">PKR ${Utils.formatPKR(totalAmt)}</td>
                <td class="text-right">PKR ${Utils.formatPKR(totalRcvd)}</td>
                <td class="text-right font-bold" style="color:${balance > 0 ? 'var(--accent-warning)' : 'var(--accent-success)'}">PKR ${Utils.formatPKR(balance)}</td>
                <td><div class="table-actions">
                    <button class="btn btn-icon btn-ghost btn-sm" onclick="Buyers.printLedger('${b.id}')" title="Print Ledger (PDF)">🖨️</button>
                    <button class="btn btn-icon btn-ghost btn-sm" onclick="Buyers.exportLedgerExcel('${b.id}')" title="Export Ledger (Excel)">📊</button>
                    <button class="btn btn-icon btn-ghost btn-sm" onclick="Buyers.edit('${b.id}')" title="Edit">✏️</button>
                    <button class="btn btn-icon btn-danger btn-sm" onclick="Buyers.delete('${b.id}')" title="Delete">🗑️</button>
                </div></td>
            </tr>`;
        }).join('');
    },

    showAddModal() {
        document.getElementById('bm-name').value = '';
        document.getElementById('bm-phone').value = '';
        document.getElementById('bm-address').value = '';
        document.getElementById('bm-notes').value = '';
        document.getElementById('bm-name').dataset.editId = '';
        document.querySelector('#buyer-modal .modal-title').textContent = 'Add Buyer';
        Utils.showModal('buyer-modal');
    },

    async edit(id) {
        const b = await DB.get('buyers', id);
        if (!b) return;
        document.getElementById('bm-name').value = b.name;
        document.getElementById('bm-phone').value = b.phone || '';
        document.getElementById('bm-address').value = b.address || '';
        document.getElementById('bm-notes').value = b.notes || '';
        document.getElementById('bm-name').dataset.editId = id;
        document.querySelector('#buyer-modal .modal-title').textContent = 'Edit Buyer';
        Utils.showModal('buyer-modal');
    },

    async save() {
        const name = document.getElementById('bm-name').value.trim();
        if (!name) { Utils.showToast('Name is required', 'error'); return; }
        const editId = document.getElementById('bm-name').dataset.editId;
        const data = {
            id: editId || Utils.generateId(),
            name,
            phone: document.getElementById('bm-phone').value.trim(),
            address: document.getElementById('bm-address').value.trim(),
            notes: document.getElementById('bm-notes').value.trim(),
            createdAt: new Date().toISOString()
        };
        await DB.put('buyers', data);
        Utils.hideModal('buyer-modal');
        Utils.showToast('Buyer saved!');
        this.render();
        Selling.loadBuyerDatalist();
    },

    async delete(id) {
        if (!await Utils.confirm('Delete this buyer? Associated sale records will NOT be deleted.')) return;
        await DB.delete('buyers', id);
        Utils.showToast('Buyer deleted!');
        this.render();
    },

    async exportExcel() {
        const buyers = await DB.getAll('buyers');
        const sales = await DB.getAll('sales');
        if (!buyers.length) { Utils.showToast('No data to export', 'warning'); return; }

        const rows = buyers.sort((a, b) => a.name.localeCompare(b.name)).map(b => {
            const bs = sales.filter(s => s.buyerName.toLowerCase() === b.name.toLowerCase());
            const totalAmt = bs.reduce((s, x) => s + (x.amount || 0), 0);
            const totalRcvd = bs.reduce((s, x) => s + (x.amountReceived || 0), 0);
            return {
                'Name': b.name,
                'Phone': b.phone || '',
                'Total Sales': bs.length,
                'Total Amount': totalAmt,
                'Total Received': totalRcvd,
                'Balance': totalAmt - totalRcvd
            };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Buyers');
        XLSX.writeFile(wb, `Buyers_${Utils.todayISO()}.xlsx`);
        Utils.showToast('Excel exported!');
    },

    async exportLedgerExcel(buyerId) {
        const buyer = await DB.get('buyers', buyerId);
        if (!buyer) return;
        const allSales = await DB.getAll('sales');
        const allPayments = await DB.getAll('sale_payments');
        const bNameLower = buyer.name.toLowerCase();

        const bs = allSales.filter(s => s.buyerName.toLowerCase() === bNameLower);
        const payments = allPayments.filter(p => p.buyerName.toLowerCase() === bNameLower);

        let transactions = [];

        bs.forEach(s => {
            const totalBill = s.amount || 0;
            transactions.push({
                date: new Date(s.date || s.createdAt),
                dateStr: Utils.formatDate(s.date),
                desc: `Sale #${s.id} - ${s.crop}`,
                receivable: totalBill,
                received: 0
            });
            const laterPayments = payments.filter(pay => pay.saleId === s.id).reduce((sum, pay) => sum + (pay.amount || 0), 0);
            const initialRcvd = (s.amountReceived || 0) - laterPayments;
            if (initialRcvd > 0) {
                transactions.push({
                    date: new Date(s.date || s.createdAt),
                    dateStr: Utils.formatDate(s.date),
                    desc: `Advance Received for #${s.id}`,
                    receivable: 0,
                    received: initialRcvd
                });
            }
        });

        payments.forEach(pay => {
            transactions.push({
                date: new Date(pay.date || pay.createdAt),
                dateStr: Utils.formatDate(pay.date),
                desc: `Payment for #${pay.saleId} (${pay.mode || 'Cash'})` + (pay.reference ? ` Ref: ${pay.reference}` : ''),
                receivable: 0,
                received: pay.amount || 0
            });
        });

        transactions.sort((a, b) => a.date - b.date);

        let balance = 0;
        const rows = transactions.map(t => {
            balance += t.receivable;
            balance -= t.received;
            return {
                'Date': t.dateStr,
                'Description': t.desc,
                'Receivable (+) (PKR)': t.receivable,
                'Received (-) (PKR)': t.received,
                'Balance (PKR)': balance
            };
        });

        if (!rows.length) { Utils.showToast('No ledger transactions to export', 'warning'); return; }

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
        XLSX.writeFile(wb, `${buyer.name.replace(/\\s+/g, '_')}_Buyer_Ledger_${Utils.todayISO()}.xlsx`);
        Utils.showToast('Buyer Ledger extracted into Excel!');
    },

    async printLedger(buyerId) {
        try {
            Utils.showLoading('Generating Buyer Ledger PDF...');
            const buyer = await DB.get('buyers', buyerId);
            if (!buyer) { Utils.hideLoading(); Utils.showToast('Buyer not found', 'error'); return; }

            const biz = await Settings.getBusiness();
            const allSales = await DB.getAll('sales');
            const allPayments = await DB.getAll('sale_payments');

            const bNameLower = buyer.name.toLowerCase();
            const bs = allSales.filter(s => s.buyerName.toLowerCase() === bNameLower);
            const payments = allPayments.filter(p => p.buyerName.toLowerCase() === bNameLower);

            let transactions = [];

            bs.forEach(s => {
                const totalBill = s.amount || 0;
                transactions.push({
                    date: new Date(s.date || s.createdAt),
                    dateStr: Utils.formatDate(s.date),
                    desc: `Sale #${s.id} - ${s.crop} (${Utils.formatNum(s.netWeight, 2)} KG @ PKR ${Utils.formatPKR(s.rate)}/Mn)`,
                    receivable: totalBill,
                    received: 0
                });
                const laterPayments = payments.filter(pay => pay.saleId === s.id).reduce((sum, pay) => sum + (pay.amount || 0), 0);
                const initialRcvd = (s.amountReceived || 0) - laterPayments;
                if (initialRcvd > 0) {
                    transactions.push({
                        date: new Date(s.date || s.createdAt),
                        dateStr: Utils.formatDate(s.date),
                        desc: `  > Advance Received for #${s.id}`,
                        receivable: 0,
                        received: initialRcvd
                    });
                }
            });

            payments.forEach(pay => {
                transactions.push({
                    date: new Date(pay.date || pay.createdAt),
                    dateStr: Utils.formatDate(pay.date),
                    desc: `Payment [${(pay.mode || 'Cash').toUpperCase()}] for #${pay.saleId}` + (pay.reference ? ` (Ref: ${pay.reference})` : ''),
                    receivable: 0,
                    received: pay.amount || 0
                });
            });

            transactions.sort((a, b) => a.date - b.date);

            let balance = 0;
            let totalReceivable = 0;
            let totalReceived = 0;
            const tableBody = transactions.map(t => {
                balance += t.receivable;
                balance -= t.received;
                totalReceivable += t.receivable;
                totalReceived += t.received;
                return [
                    t.dateStr,
                    t.desc,
                    t.receivable > 0 ? 'PKR ' + Utils.formatPKR(t.receivable) : '',
                    t.received > 0 ? 'PKR ' + Utils.formatPKR(t.received) : '',
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
            doc.text('Commission Shop / Agricultural Trader', 105, 21, { align: 'center' });
            doc.text('Phone: ' + (biz.phone || '-'), 105, 26, { align: 'center' });

            doc.setLineWidth(0.8); doc.line(15, 29, 195, 29);
            doc.setLineWidth(0.3); doc.line(15, 30, 195, 30);

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('BUYER STATEMENT OF ACCOUNT', 105, 37, { align: 'center' });
            doc.setLineWidth(0.15); doc.line(15, 40, 195, 40);

            // Buyer Info Box
            doc.setFillColor(245, 245, 245);
            doc.rect(15, 43, 180, 18, 'F');
            doc.setLineWidth(0.15);
            doc.rect(15, 43, 180, 18, 'S');

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Account:', 18, 50);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.text(buyer.name.toUpperCase(), 36, 50);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Phone:', 18, 56);
            doc.setFont('helvetica', 'normal');
            doc.text(buyer.phone || 'N/A', 32, 56);

            doc.setFont('helvetica', 'bold');
            doc.text('Statement Date:', 130, 50);
            doc.setFont('helvetica', 'normal');
            doc.text(Utils.formatDate(new Date().toISOString()), 163, 50);

            doc.setFont('helvetica', 'bold');
            doc.text('Total Sales:', 130, 56);
            doc.setFont('helvetica', 'normal');
            doc.text(String(bs.length), 155, 56);

            // Ledger Table
            doc.autoTable({
                startY: 66,
                head: [['Date', 'Description', 'Receivable (+)', 'Received (-)', 'Balance']],
                body: tableBody,
                foot: [[
                    '', 'TOTALS',
                    'PKR ' + Utils.formatPKR(totalReceivable),
                    'PKR ' + Utils.formatPKR(totalReceived),
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

            // Final Balance Box
            const fy = doc.lastAutoTable.finalY + 8;
            const balText = balance > 0
                ? `BALANCE DUE: BUYER OWES SHOP  PKR ${Utils.formatPKR(balance)}`
                : balance < 0
                    ? `BALANCE DUE: SHOP OWES BUYER  PKR ${Utils.formatPKR(Math.abs(balance))}  (Advance)`
                    : 'BALANCE CLEARED - ALL ACCOUNTS SETTLED (PKR 0.00)';

            doc.setLineWidth(0.5);
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
            doc.text('Buyer Signature / Stamp', 45, sy + 5, { align: 'center' });
            doc.text('Authorized Signature / Stamp', 165, sy + 5, { align: 'center' });

            // Footer
            doc.setFontSize(6);
            doc.setTextColor(120);
            doc.text('Auto-generated by AgriSys on ' + new Date().toLocaleString(), 105, sy + 12, { align: 'center' });
            doc.setTextColor(0);

            doc.save(`Buyer_Ledger_${buyer.name.replace(/\s+/g, '_')}.pdf`);
            Utils.hideLoading();
            Utils.showToast('Buyer Ledger PDF generated!');
        } catch (err) {
            Utils.hideLoading();
            console.error('Buyer Ledger PDF error:', err);
            Utils.showToast('PDF error: ' + err.message, 'error');
        }
    }
};
