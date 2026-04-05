// ===== Farmers Module =====
const Farmers = {
    async init() {},

    async ensureFarmer(name) {
        if (!name) return;
        const all = await DB.getAll('farmers');
        const exists = all.find(f => f.name.toLowerCase() === name.toLowerCase());
        if (!exists) {
            await DB.put('farmers', { id: Utils.generateId(), name, phone: '', address: '', notes: '', createdAt: new Date().toISOString() });
        }
    },

    async render() {
        const farmers = await DB.getAll('farmers');
        const purchases = await DB.getAll('purchases');
        const advances = await DB.getAll('farmer_advances');
        const search = (document.getElementById('f-search').value || '').toLowerCase();

        const filtered = farmers.filter(f => !search || f.name.toLowerCase().includes(search) || (f.phone || '').includes(search));

        const tbody = document.getElementById('farmers-tbody');
        const empty = document.getElementById('farmers-empty');

        if (filtered.length === 0) { tbody.innerHTML = ''; empty.style.display = ''; return; }
        empty.style.display = 'none';

        tbody.innerHTML = filtered.map(f => {
            const fp = purchases.filter(p => p.farmerName.toLowerCase() === f.name.toLowerCase());
            const totalAmt = fp.reduce((s, p) => s + (p.netPayableAmount || p.amount || 0), 0);
            const totalPaid = fp.reduce((s, p) => s + (p.amountPaid || 0), 0);
            const openAdv = advances.filter(a => a.farmerName.toLowerCase() === f.name.toLowerCase()).reduce((s, a) => s + a.amount, 0);
            const balance = totalAmt - totalPaid;
            return `<tr>
                <td class="font-bold">${Utils.highlightText(f.name, search)}</td>
                <td>${Utils.highlightText(f.phone || '-', search)}</td>
                <td class="text-center">${fp.length}</td>
                <td class="text-right">PKR ${Utils.formatPKR(totalAmt)}</td>
                <td class="text-right">PKR ${Utils.formatPKR(totalPaid)}</td>
                <td class="text-right font-bold" style="color:${openAdv > 0 ? 'var(--accent-warning)' : 'inherit'}">PKR ${Utils.formatPKR(openAdv)}</td>
                <td class="text-right font-bold" style="color:${balance > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'}">PKR ${Utils.formatPKR(balance)}</td>
                <td><div class="table-actions">
                    <button class="btn btn-icon btn-ghost btn-sm" onclick="ReceiptPDF.generateFarmerLedger('${f.id}')" title="Print Ledger (PDF)">🖨️</button>
                    <button class="btn btn-icon btn-ghost btn-sm" onclick="Farmers.exportLedgerExcel('${f.id}')" title="Export Ledger (Excel)">📊</button>
                    <button class="btn btn-icon btn-ghost btn-sm" onclick="Farmers.edit('${f.id}')" title="Edit">✏️</button>
                    <button class="btn btn-icon btn-danger btn-sm" onclick="Farmers.delete('${f.id}')" title="Delete">🗑️</button>
                </div></td>
            </tr>`;
        }).join('');
    },

    showAddModal() {
        document.getElementById('fm-name').value = '';
        document.getElementById('fm-phone').value = '';
        document.getElementById('fm-address').value = '';
        document.getElementById('fm-notes').value = '';
        document.getElementById('fm-name').dataset.editId = '';
        Utils.showModal('farmer-modal');
    },

    async edit(id) {
        const f = await DB.get('farmers', id);
        if (!f) return;
        document.getElementById('fm-name').value = f.name;
        document.getElementById('fm-phone').value = f.phone || '';
        document.getElementById('fm-address').value = f.address || '';
        document.getElementById('fm-notes').value = f.notes || '';
        document.getElementById('fm-name').dataset.editId = id;
        Utils.showModal('farmer-modal');
    },

    async save() {
        const name = document.getElementById('fm-name').value.trim();
        if (!name) { Utils.showToast('Name is required', 'error'); return; }
        const editId = document.getElementById('fm-name').dataset.editId;
        const data = {
            id: editId || Utils.generateId(),
            name,
            phone: document.getElementById('fm-phone').value.trim(),
            address: document.getElementById('fm-address').value.trim(),
            notes: document.getElementById('fm-notes').value.trim(),
            createdAt: new Date().toISOString()
        };
        await DB.put('farmers', data);
        Utils.hideModal('farmer-modal');
        Utils.showToast('Farmer saved!');
        this.render();
        Purchasing.loadFarmerDatalist();
    },

    async showAdvanceModal() {
        document.getElementById('adv-farmer').value = '';
        document.getElementById('adv-date').value = Utils.todayISO();
        document.getElementById('adv-amount').value = '';
        document.getElementById('adv-notes').value = '';
        await this.loadAdvanceAccounts();
        await this.loadAdvanceDatalist();
        Utils.showModal('advance-modal');
    },

    async loadAdvanceAccounts() {
        const accounts = await DB.getAll('capital_accounts');
        const sel = document.getElementById('adv-account');
        if (accounts.length === 0) {
            sel.innerHTML = '<option value="">(No Accounts Available)</option>';
        } else {
            sel.innerHTML = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        }
    },

    async loadAdvanceDatalist() {
        const farmers = await DB.getAll('farmers');
        document.getElementById('adv-farmer-datalist').innerHTML = farmers.map(f => `<option value="${f.name}">`).join('');
    },

    async saveAdvance() {
        const farmerName = document.getElementById('adv-farmer').value.trim();
        const amount = Utils.pf(document.getElementById('adv-amount').value);
        const accountId = document.getElementById('adv-account').value;
        const date = document.getElementById('adv-date').value;
        const notes = document.getElementById('adv-notes').value.trim();

        if (!farmerName) { Utils.showToast('Select a farmer', 'error'); return; }
        if (amount <= 0) { Utils.showToast('Enter a valid amount', 'error'); return; }

        await this.ensureFarmer(farmerName);

        // Save advance
        const advId = Utils.generateId();
        await DB.put('farmer_advances', {
            id: advId, farmerName, amount, date, notes, createdAt: new Date().toISOString()
        });

        // Deduct from capital account if present
        if (accountId) {
            await DB.put('capital_transactions', {
                id: Utils.generateId(), accountId, type: 'withdrawal', amount, date,
                description: `Advance paid to ${farmerName}` + (notes ? ` - ${notes}` : ''),
                createdAt: new Date().toISOString()
            });
        }

        Utils.hideModal('advance-modal');
        Utils.showToast('Advance recorded successfully!');
        this.render();
    },

    async delete(id) {
        const farmer = await DB.get('farmers', id);
        if (!farmer) return;

        // Check for associated purchases
        const purchases = await DB.getAll('purchases');
        const linked = purchases.filter(p => p.farmerName.toLowerCase() === farmer.name.toLowerCase());

        let msg = 'Delete this farmer?';
        if (linked.length > 0) {
            msg = `This farmer has ${linked.length} linked purchase(s). Only the farmer record will be deleted — purchases will be preserved. Continue?`;
        }

        if (!await Utils.confirm(msg)) return;
        await DB.delete('farmers', id);
        Utils.showToast('Farmer deleted!');
        this.render();
    },

    async exportExcel() {
        const farmers = await DB.getAll('farmers');
        const purchases = await DB.getAll('purchases');
        const advances = await DB.getAll('farmer_advances');
        if (!farmers.length) { Utils.showToast('No data to export', 'warning'); return; }
        
        const rows = farmers.sort((a,b) => a.name.localeCompare(b.name)).map(f => {
            const fp = purchases.filter(p => p.farmerName.toLowerCase() === f.name.toLowerCase());
            const totalAmt = fp.reduce((s, p) => s + (p.netPayableAmount || p.amount || 0), 0);
            const totalPaid = fp.reduce((s, p) => s + (p.amountPaid || 0), 0);
            const openAdv = advances.filter(a => a.farmerName.toLowerCase() === f.name.toLowerCase()).reduce((s, a) => s + a.amount, 0);
            return {
                'Name': f.name,
                'Phone': f.phone || '',
                'Total Purchases': fp.length,
                'Total Amount': totalAmt,
                'Total Paid': totalPaid,
                'Open Advances': openAdv,
                'Balance': totalAmt - totalPaid
            };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Farmers');
        XLSX.writeFile(wb, `Farmers_${Utils.todayISO()}.xlsx`);
        Utils.showToast('Excel exported!');
    },

    async exportLedgerExcel(farmerId) {
        const farmer = await DB.get('farmers', farmerId);
        if (!farmer) return;
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
                desc: `Purchase #${p.id} - ${p.crop}`,
                payable: totalBill,
                paid: 0
            });
            const laterPayments = payments.filter(pay => pay.purchaseId === p.id).reduce((s, pay) => s + (pay.amount || 0), 0);
            const initialPaid = (p.amountPaid || 0) - laterPayments;
            if (initialPaid > 0) {
                transactions.push({
                    date: new Date(p.date || p.createdAt),
                    dateStr: Utils.formatDate(p.date),
                    desc: `Advance Paid for #${p.id}`,
                    payable: 0,
                    paid: initialPaid
                });
            }
        });

        payments.forEach(pay => {
            transactions.push({
                date: new Date(pay.date || pay.createdAt),
                dateStr: Utils.formatDate(pay.date),
                desc: `Payment against #${pay.purchaseId} (${pay.mode || 'Cash'})` + (pay.reference ? ` Ref: ${pay.reference}` : ''),
                payable: 0,
                paid: pay.amount || 0
            });
        });

        transactions.sort((a, b) => a.date - b.date);

        let balance = 0;
        const rows = transactions.map(t => {
            balance += t.payable;
            balance -= t.paid;
            return {
                'Date': t.dateStr,
                'Description': t.desc,
                'Payable (+) (PKR)': t.payable,
                'Paid (-) (PKR)': t.paid,
                'Balance (PKR)': balance
            };
        });

        if (!rows.length) { Utils.showToast('No ledger transactions to export', 'warning'); return; }

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
        XLSX.writeFile(wb, `${farmer.name.replace(/\\s+/g, '_')}_Ledger_${Utils.todayISO()}.xlsx`);
        Utils.showToast('Farmer Ledger Extracted into Excel!');
    }
};
