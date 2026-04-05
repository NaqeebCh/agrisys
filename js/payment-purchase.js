// ===== Purchase Payment Tracking =====
const PurchasePayments = {
    async render() {
        const purchases = await DB.getAll('purchases');
        const search = (document.getElementById('pp-search').value || '').toLowerCase();
        const filter = document.getElementById('pp-filter').value;

        let filtered = purchases.filter(p => {
            if (search && !p.farmerName.toLowerCase().includes(search) && !p.id.toLowerCase().includes(search)) return false;
            if (filter && p.paymentStatus !== filter) return false;
            return true;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        const tbody = document.getElementById('pp-tbody');
        tbody.innerHTML = filtered.map(p => {
            const amt = p.netPayableAmount || p.amount || 0;
            const paid = p.amountPaid || 0;
            const balance = amt - paid;
            return `<tr>
                <td class="font-bold">${p.id}</td>
                <td>${Utils.formatDate(p.date)}</td>
                <td class="font-bold">${p.farmerName}</td>
                <td>${p.crop}</td>
                <td class="text-right">PKR ${Utils.formatPKR(amt)}</td>
                <td class="text-right">PKR ${Utils.formatPKR(paid)}</td>
                <td class="text-right font-bold" style="color:${balance > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'}">PKR ${Utils.formatPKR(balance)}</td>
                <td>${Utils.statusBadge(p.paymentStatus)}</td>
                <td><button class="btn btn-sm btn-primary" onclick="PurchasePayments.recordPayment('${p.id}')" ${p.paymentStatus === 'paid' ? 'disabled' : ''}>Pay</button></td>
            </tr>`;
        }).join('') || '<tr><td colspan="9" class="text-center" style="color:var(--text-muted)">No records</td></tr>';
    },

    async recordPayment(purchaseId) {
        const p = await DB.get('purchases', purchaseId);
        if (!p) return;
        const balance = (p.netPayableAmount || p.amount || 0) - (p.amountPaid || 0);
        document.getElementById('pay-modal-title').textContent = `Pay Farmer: ${p.farmerName} (${p.id})`;
        document.getElementById('pay-amount').value = balance.toFixed(2);
        document.getElementById('pay-amount').max = balance;
        document.getElementById('pay-date').value = Utils.todayISO();
        document.getElementById('pay-ref').value = '';
        document.getElementById('pay-notes').value = '';

        document.getElementById('pay-save-btn').onclick = async () => {
            const payAmt = Utils.pf(document.getElementById('pay-amount').value);
            if (payAmt <= 0) { Utils.showToast('Amount must be > 0', 'error'); return; }
            
            const payment = {
                id: Utils.generateId(), purchaseId, farmerName: p.farmerName,
                amount: payAmt, date: document.getElementById('pay-date').value,
                mode: document.getElementById('pay-mode').value,
                reference: document.getElementById('pay-ref').value.trim(),
                notes: document.getElementById('pay-notes').value.trim(),
                createdAt: new Date().toISOString()
            };
            await DB.put('purchase_payments', payment);

            p.amountPaid = (p.amountPaid || 0) + payAmt;
            const total = p.netPayableAmount || p.amount || 0;
            p.balance = total - p.amountPaid;
            p.paymentStatus = p.amountPaid >= total ? 'paid' : 'partial';
            await DB.put('purchases', p);

            Utils.hideModal('payment-modal');
            Utils.showToast('Payment recorded!');
            this.render();
        };
        Utils.showModal('payment-modal');
    },

    async exportExcel() {
        const purchases = await DB.getAll('purchases');
        if (!purchases.length) { Utils.showToast('No data to export', 'warning'); return; }
        
        const rows = purchases.sort((a,b) => new Date(b.date)-new Date(a.date)).map(p => {
            const amt = p.netPayableAmount || p.amount || 0;
            const paid = p.amountPaid || 0;
            return {
                'Receipt ID': p.id,
                'Date': p.date,
                'Farmer': p.farmerName,
                'Crop': p.crop || '',
                'Amount': amt,
                'Total Paid': paid,
                'Balance': amt - paid,
                'Status': p.paymentStatus
            };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Farmer Payments');
        XLSX.writeFile(wb, `Farmer_Payments_${Utils.todayISO()}.xlsx`);
        Utils.showToast('Excel exported!');
    }
};
