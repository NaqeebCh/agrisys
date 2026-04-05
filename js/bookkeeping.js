// ===== Bookkeeping Module — Professional Journal Entries =====
const Bookkeeping = {
    async render() {
        const from = document.getElementById('bk-from').value;
        const to = document.getElementById('bk-to').value;

        const entries = await this.generateEntries(from, to);
        const tbody = document.getElementById('bk-tbody');

        // Calculate totals
        const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
        const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);

        let html = entries.map(e => `<tr>
            <td>${Utils.formatDate(e.date)}</td>
            <td>${e.description}</td>
            <td>${e.account}</td>
            <td class="text-right">${e.debit ? 'PKR ' + Utils.formatPKR(e.debit) : ''}</td>
            <td class="text-right">${e.credit ? 'PKR ' + Utils.formatPKR(e.credit) : ''}</td>
        </tr>`).join('');

        // Add totals row
        if (entries.length > 0) {
            html += `<tr style="border-top:2px solid var(--accent-primary);font-weight:700">
                <td colspan="3" style="text-align:right;padding-right:12px">TOTALS</td>
                <td class="text-right">PKR ${Utils.formatPKR(totalDebit)}</td>
                <td class="text-right">PKR ${Utils.formatPKR(totalCredit)}</td>
            </tr>`;
            // Balance check indicator
            const diff = Math.abs(totalDebit - totalCredit);
            if (diff < 0.01) {
                html += `<tr><td colspan="5" style="text-align:center;color:var(--accent-success);font-size:0.85rem;padding:8px">✓ Books are balanced (Debits = Credits)</td></tr>`;
            } else {
                html += `<tr><td colspan="5" style="text-align:center;color:var(--accent-danger);font-size:0.85rem;padding:8px">⚠ Difference of PKR ${Utils.formatPKR(diff)} — please review entries</td></tr>`;
            }
        }

        tbody.innerHTML = html || '<tr><td colspan="5" class="text-center" style="color:var(--text-muted)">No entries found. Select a date range or use "All Time" preset.</td></tr>';
    },

    async generateEntries(from, to) {
        const purchases = await DB.getAll('purchases');
        const sales = await DB.getAll('sales');
        const pPayments = await DB.getAll('purchase_payments');
        const sPayments = await DB.getAll('sale_payments');
        const expenses = await DB.getAll('expenses');
        let entries = [];

        // ── Purchase entries (Double-entry) ──
        purchases.forEach(p => {
            const amt = p.netPayableAmount || p.amount || 0;
            entries.push({ date: p.date, description: `Purchase: ${p.farmerName} - ${p.crop} (#${p.id})`, account: 'Inventory / Purchases', debit: amt, credit: 0, type: 'purchase' });
            entries.push({ date: p.date, description: `Purchase: ${p.farmerName} - ${p.crop} (#${p.id})`, account: 'Accounts Payable (Farmer)', debit: 0, credit: amt, type: 'purchase' });
        });

        // ── Sale entries ──
        sales.forEach(s => {
            entries.push({ date: s.date, description: `Sale: ${s.buyerName} - ${s.crop} (#${s.id})`, account: 'Accounts Receivable (Buyer)', debit: s.amount, credit: 0, type: 'sale' });
            entries.push({ date: s.date, description: `Sale: ${s.buyerName} - ${s.crop} (#${s.id})`, account: 'Sales Revenue', debit: 0, credit: s.amount, type: 'sale' });
        });

        // ── Purchase payment entries ──
        pPayments.forEach(p => {
            entries.push({ date: p.date, description: `Payment to: ${p.farmerName} (#${p.purchaseId}) [${(p.mode||'Cash').toUpperCase()}]`, account: 'Accounts Payable (Farmer)', debit: p.amount, credit: 0, type: 'payment' });
            entries.push({ date: p.date, description: `Payment to: ${p.farmerName} (#${p.purchaseId}) [${(p.mode||'Cash').toUpperCase()}]`, account: 'Cash / Bank', debit: 0, credit: p.amount, type: 'payment' });
        });

        // ── Sale payment received entries ──
        sPayments.forEach(p => {
            entries.push({ date: p.date, description: `Received from: ${p.buyerName} (#${p.saleId}) [${(p.mode||'Cash').toUpperCase()}]`, account: 'Cash / Bank', debit: p.amount, credit: 0, type: 'receipt' });
            entries.push({ date: p.date, description: `Received from: ${p.buyerName} (#${p.saleId}) [${(p.mode||'Cash').toUpperCase()}]`, account: 'Accounts Receivable (Buyer)', debit: 0, credit: p.amount, type: 'receipt' });
        });

        // ── Expense entries ──
        expenses.forEach(e => {
            const desc = `Expense: ${e.type}${e.description ? ' - ' + e.description : ''}`;
            entries.push({ date: e.date, description: desc, account: 'Operating Expenses', debit: e.amount, credit: 0, type: 'expense' });
            entries.push({ date: e.date, description: desc, account: 'Cash / Bank', debit: 0, credit: e.amount, type: 'expense' });
        });

        // Filter by date range
        if (from) entries = entries.filter(e => e.date >= from);
        if (to) entries = entries.filter(e => e.date <= to);

        entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        return entries;
    },

    async regenerate() {
        Utils.showToast('Bookkeeping journal regenerated!');
        this.render();
    },

    async exportExcel() {
        const entries = await this.generateEntries(document.getElementById('bk-from').value, document.getElementById('bk-to').value);
        if (!entries.length) { Utils.showToast('No data to export', 'warning'); return; }
        
        const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
        const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);

        const rows = entries.map(e => ({
            'Date': e.date,
            'Description': e.description,
            'Account': e.account,
            'Debit (PKR)': e.debit || '',
            'Credit (PKR)': e.credit || ''
        }));

        // Add totals row
        rows.push({ 'Date': '', 'Description': 'TOTALS', 'Account': '', 'Debit (PKR)': totalDebit, 'Credit (PKR)': totalCredit });
        
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Journal');
        XLSX.writeFile(wb, `Bookkeeping_Journal_${Utils.todayISO()}.xlsx`);
        Utils.showToast('Journal Excel exported!');
    },

    async exportPDF() {
        const from = document.getElementById('bk-from').value;
        const to = document.getElementById('bk-to').value;
        const entries = await this.generateEntries(from, to);
        if (!entries.length) { Utils.showToast('No journal entries to export', 'warning'); return; }
        Utils.showLoading('Generating Journal PDF...');

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const biz = await Settings.getBusiness();

            // Header — Use shared approach
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text((biz.bizName || 'AgriSys').toUpperCase(), 105, 15, { align: 'center' });
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('Commission Shop / Agricultural Trader', 105, 21, { align: 'center' });
            if (biz.phone) doc.text('Phone: ' + biz.phone, 105, 25, { align: 'center' });

            const hEnd = biz.phone ? 27 : 23;
            doc.setLineWidth(0.8); doc.line(15, hEnd, 195, hEnd);
            doc.setLineWidth(0.3); doc.line(15, hEnd + 1, 195, hEnd + 1);

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('GENERAL JOURNAL', 105, hEnd + 8, { align: 'center' });

            doc.setLineWidth(0.15); doc.line(15, hEnd + 11, 195, hEnd + 11);

            let period = 'All Time';
            if (from && to) period = `${Utils.formatDate(from)} to ${Utils.formatDate(to)}`;
            else if (from) period = `From ${Utils.formatDate(from)}`;
            else if (to) period = `Until ${Utils.formatDate(to)}`;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`Period: ${period}`, 105, hEnd + 17, { align: 'center' });
            doc.setLineWidth(0.15); doc.line(15, hEnd + 20, 195, hEnd + 20);

            // Stats row
            const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
            const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);

            // Table
            const tableBody = entries.map(e => [
                Utils.formatDate(e.date),
                e.description,
                e.account,
                e.debit ? 'PKR ' + Utils.formatPKR(e.debit) : '',
                e.credit ? 'PKR ' + Utils.formatPKR(e.credit) : ''
            ]);

            doc.autoTable({
                startY: hEnd + 25,
                head: [['Date', 'Description', 'Account', 'Debit (PKR)', 'Credit (PKR)']],
                body: tableBody,
                foot: [['', 'TOTALS', entries.length + ' entries', 'PKR ' + Utils.formatPKR(totalDebit), 'PKR ' + Utils.formatPKR(totalCredit)]],
                theme: 'grid',
                headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
                footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', fontSize: 7.5 },
                styles: { fontSize: 6.5, font: 'helvetica', textColor: 20, lineColor: 180, lineWidth: 0.12, cellPadding: 2 },
                alternateRowStyles: { fillColor: [250, 250, 250] },
                columnStyles: {
                    0: { cellWidth: 20 },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 38 },
                    3: { halign: 'right', cellWidth: 28 },
                    4: { halign: 'right', cellWidth: 28 }
                }
            });

            // Balance verification
            const fy = doc.lastAutoTable.finalY + 6;
            const diff = Math.abs(totalDebit - totalCredit);
            doc.setFontSize(8);
            if (diff < 0.01) {
                doc.setFont('helvetica', 'bold');
                doc.text('[OK] BOOKS BALANCED - Debits equal Credits', 105, fy, { align: 'center' });
            } else {
                doc.setFont('helvetica', 'bold');
                doc.text('[!] UNBALANCED - Difference: PKR ' + Utils.formatPKR(diff), 105, fy, { align: 'center' });
            }

            // Signatures
            const sy = Math.min(fy + 25, 270);
            doc.setLineWidth(0.3);
            doc.line(15, sy, 75, sy);
            doc.line(135, sy, 195, sy);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text('Prepared By', 45, sy + 5, { align: 'center' });
            doc.text('Authorized Signature', 165, sy + 5, { align: 'center' });

            // Footer
            doc.setFontSize(6);
            doc.setTextColor(120);
            doc.text('Auto-generated by AgriSys on ' + new Date().toLocaleString(), 105, sy + 12, { align: 'center' });
            doc.setTextColor(0);

            doc.save(`Journal_${Utils.todayISO()}.pdf`);
            Utils.hideLoading();
            Utils.showToast('Journal PDF generated!');
        } catch (err) {
            Utils.hideLoading();
            Utils.showToast('PDF error: ' + err.message, 'error');
        }
    }
};
