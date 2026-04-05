// ===== Sale Payment Tracking =====
const SalePayments = {
    async render() {
        const sales = await DB.getAll('sales');
        const search = (document.getElementById('sp-search').value || '').toLowerCase();
        const filter = document.getElementById('sp-filter').value;
        let filtered = sales.filter(s => {
            if (search && !s.buyerName.toLowerCase().includes(search) && !s.id.toLowerCase().includes(search)) return false;
            if (filter && s.paymentStatus !== filter) return false;
            return true;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        document.getElementById('sp-tbody').innerHTML = filtered.map(s => {
            const amt = s.amount || 0;
            const rcvd = s.amountReceived || 0;
            const bal = amt - rcvd;
            return `<tr>
                <td class="font-bold">${s.id}</td><td>${Utils.formatDate(s.date)}</td><td class="font-bold">${s.buyerName}</td>
                <td>${s.crop}</td><td class="text-right">PKR ${Utils.formatPKR(amt)}</td>
                <td class="text-right">PKR ${Utils.formatPKR(rcvd)}</td>
                <td class="text-right font-bold" style="color:${bal > 0 ? 'var(--accent-warning)' : 'var(--accent-success)'}">PKR ${Utils.formatPKR(bal)}</td>
                <td>${Utils.statusBadge(s.paymentStatus)}</td>
                <td><button class="btn btn-sm btn-primary" onclick="SalePayments.recordPayment('${s.id}')" ${s.paymentStatus==='paid'?'disabled':''}>Receive</button></td>
            </tr>`;
        }).join('') || '<tr><td colspan="9" class="text-center" style="color:var(--text-muted)">No records</td></tr>';
    },

    async recordPayment(saleId) {
        const s = await DB.get('sales', saleId);
        if (!s) return;
        const balance = (s.amount || 0) - (s.amountReceived || 0);
        document.getElementById('pay-modal-title').textContent = `Receive from: ${s.buyerName} (${s.id})`;
        document.getElementById('pay-amount').value = balance.toFixed(2);
        document.getElementById('pay-date').value = Utils.todayISO();
        document.getElementById('pay-ref').value = '';
        document.getElementById('pay-notes').value = '';

        document.getElementById('pay-save-btn').onclick = async () => {
            const payAmt = Utils.pf(document.getElementById('pay-amount').value);
            if (payAmt <= 0) { Utils.showToast('Amount must be > 0', 'error'); return; }
            const payment = {
                id: Utils.generateId(), saleId, buyerName: s.buyerName,
                amount: payAmt, date: document.getElementById('pay-date').value,
                mode: document.getElementById('pay-mode').value,
                reference: document.getElementById('pay-ref').value.trim(),
                notes: document.getElementById('pay-notes').value.trim(),
                createdAt: new Date().toISOString()
            };
            await DB.put('sale_payments', payment);
            s.amountReceived = (s.amountReceived || 0) + payAmt;
            s.balance = (s.amount || 0) - s.amountReceived;
            s.paymentStatus = s.amountReceived >= (s.amount || 0) ? 'paid' : 'partial';
            await DB.put('sales', s);
            Utils.hideModal('payment-modal');
            Utils.showToast('Payment received!');
            this.render();
        };
        Utils.showModal('payment-modal');
    },

    async exportExcel() {
        const sales = await DB.getAll('sales');
        if (!sales.length) { Utils.showToast('No data to export', 'warning'); return; }
        
        const rows = sales.sort((a,b) => new Date(b.date)-new Date(a.date)).map(s => {
            const amt = s.amount || 0;
            const rcvd = s.amountReceived || 0;
            return {
                'Receipt ID': s.id,
                'Date': s.date,
                'Buyer': s.buyerName,
                'Crop': s.crop || '',
                'Amount': amt,
                'Total Received': rcvd,
                'Balance': amt - rcvd,
                'Status': s.paymentStatus
            };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Buyer Payments');
        XLSX.writeFile(wb, `Buyer_Payments_${Utils.todayISO()}.xlsx`);
        Utils.showToast('Excel exported!');
    }
};
