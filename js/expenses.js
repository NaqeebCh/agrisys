// ===== Expenses Module =====
const Expenses = {
    currentTab: 'all',

    setTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('#expenses-tabs .tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`#expenses-tabs .tab:nth-child(${tab==='all'?1:tab==='receipt'?2:tab==='general'?3:4})`).classList.add('active');
        this.render();
    },

    async render() {
        if (this.currentTab === 'analysis') { await this.renderCropAnalysis(); return; }
        document.getElementById('expenses-table-container').style.display = '';
        document.getElementById('crop-analysis').style.display = 'none';

        const all = await DB.getAll('expenses');
        let filtered = all;
        if (this.currentTab === 'receipt') filtered = all.filter(e => e.purchaseId);
        else if (this.currentTab === 'general') filtered = all.filter(e => !e.purchaseId);
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        document.getElementById('expenses-tbody').innerHTML = filtered.map(e => `<tr>
            <td>${Utils.formatDate(e.date)}</td><td><span class="badge badge-info">${e.type}</span></td>
            <td>${e.description || '-'}</td><td>${e.crop || '-'}</td>
            <td>${e.purchaseId || '-'}</td><td class="text-right font-bold">PKR ${Utils.formatPKR(e.amount)}</td>
            <td><button class="btn btn-icon btn-danger btn-sm" onclick="Expenses.delete('${e.id}')">🗑️</button></td>
        </tr>`).join('') || '<tr><td colspan="7" class="text-center" style="color:var(--text-muted)">No expenses</td></tr>';
    },

    async renderCropAnalysis() {
        document.getElementById('expenses-table-container').style.display = 'none';
        document.getElementById('crop-analysis').style.display = '';
        const purchases = await DB.getAll('purchases');
        const expenses = await DB.getAll('expenses');
        const crops = [...new Set([...purchases.map(p => p.crop), ...expenses.map(e => e.crop).filter(c => c)])];

        let html = '<div class="stats-grid">';
        crops.forEach(crop => {
            const cp = purchases.filter(p => p.crop === crop);
            const ce = expenses.filter(e => e.crop === crop);
            const purchaseCost = cp.reduce((s, p) => s + (p.netPayableAmount || p.amount || 0), 0);
            const expenseCost = ce.reduce((s, e) => s + (e.amount || 0), 0);
            const totalCost = purchaseCost + expenseCost;
            const totalWeight = cp.reduce((s, p) => s + (p.netWeight || 0), 0);
            const costPerMn = totalWeight > 0 ? totalCost / (totalWeight / 40) : 0;
            html += `<div class="stat-card blue">
                <div class="stat-label">${crop}</div>
                <div class="stat-value">PKR ${Utils.formatPKR(totalCost)}</div>
                <div class="stat-sub">Purchase: PKR ${Utils.formatPKR(purchaseCost)} | Expenses: PKR ${Utils.formatPKR(expenseCost)}</div>
                <div class="stat-sub">Total Weight: ${Utils.formatNum(totalWeight)} KG | Cost/Mn: PKR ${Utils.formatPKR(costPerMn)}</div>
            </div>`;
        });
        html += '</div>';
        document.getElementById('crop-analysis').innerHTML = html || '<div class="empty-state"><h3>No data for analysis</h3></div>';
    },

    showAddModal() {
        document.getElementById('exp-date').value = Utils.todayISO();
        document.getElementById('exp-desc').value = '';
        document.getElementById('exp-amount').value = '';
        document.getElementById('exp-type').value = 'labour';
        document.getElementById('exp-crop').value = '';
        // Populate receipt dropdown
        this.populateReceiptSelect();
        Utils.showModal('expense-modal');
    },

    async populateReceiptSelect() {
        const purchases = await DB.getAll('purchases');
        const sel = document.getElementById('exp-receipt');
        sel.innerHTML = '<option value="">None</option>';
        purchases.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(p => {
            sel.innerHTML += `<option value="${p.id}">${p.id} - ${p.farmerName} (${p.crop})</option>`;
        });
    },

    async save() {
        const amount = Utils.pf(document.getElementById('exp-amount').value);
        if (amount <= 0) { Utils.showToast('Amount required', 'error'); return; }
        const data = {
            id: Utils.generateId(),
            date: document.getElementById('exp-date').value,
            type: document.getElementById('exp-type').value,
            description: document.getElementById('exp-desc').value.trim(),
            amount,
            crop: document.getElementById('exp-crop').value,
            purchaseId: document.getElementById('exp-receipt').value,
            createdAt: new Date().toISOString()
        };
        await DB.put('expenses', data);
        Utils.hideModal('expense-modal');
        Utils.showToast('Expense saved!');
        this.render();
    },

    async delete(id) {
        if (!await Utils.confirm('Delete this expense?')) return;
        await DB.delete('expenses', id);
        Utils.showToast('Deleted!');
        this.render();
    },

    async exportExcel() {
        const all = await DB.getAll('expenses');
        if (!all.length) { Utils.showToast('No data to export', 'warning'); return; }
        
        const rows = all.sort((a,b) => new Date(b.date)-new Date(a.date)).map(e => ({
            'Date': e.date,
            'Type': e.type,
            'Description': e.description,
            'Crop': e.crop || '',
            'Linked Receipt': e.purchaseId || '',
            'Amount': e.amount
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
        XLSX.writeFile(wb, `Expenses_${Utils.todayISO()}.xlsx`);
        Utils.showToast('Excel exported!');
    }
};
