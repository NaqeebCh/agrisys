// ===== Selling Module =====
const Selling = {
    additionalDeductions: [],
    receiptImage: null,
    editingId: null,

    async init() {
        document.getElementById('s-date').value = Utils.todayISO();
        document.getElementById('s-id').value = await Utils.getNextReceiptId('sale');
        await this.loadBuyerDatalist();
    },

    async loadBuyerDatalist() {
        // Pull from buyers DB first, then unique names from sales as fallback
        const buyers = await DB.getAll('buyers');
        const sales = await DB.getAll('sales');
        const buyerNames = new Set(buyers.map(b => b.name));
        sales.forEach(s => { if (s.buyerName) buyerNames.add(s.buyerName); });
        document.getElementById('buyer-datalist').innerHTML = [...buyerNames].sort().map(b => `<option value="${b}">`).join('');
    },

    addDeduction() {
        const id = Date.now();
        this.additionalDeductions.push({ id, name: '', amount: 0, unit: 'kg' });
        this.renderDeductions();
    },

    removeDeduction(id) {
        this.additionalDeductions = this.additionalDeductions.filter(d => d.id !== id);
        this.renderDeductions();
        this.calculate();
    },

    renderDeductions() {
        const c = document.getElementById('s-deductions');
        c.innerHTML = this.additionalDeductions.map(d => `
            <div class="deduction-row">
                <div class="form-group"><label class="form-label">Name</label><input class="form-input" value="${d.name}" onchange="Selling.updateDed(${d.id},'name',this.value)"></div>
                <div class="form-group"><label class="form-label">Amount</label><input class="form-input" type="number" value="${d.amount}" step="0.01" oninput="Selling.updateDed(${d.id},'amount',this.value);Selling.calculate()"></div>
                <div class="form-group"><label class="form-label">Unit</label><select class="form-select" onchange="Selling.updateDed(${d.id},'unit',this.value);Selling.calculate()"><option value="kg" ${d.unit==='kg'?'selected':''}>KG</option><option value="pkr" ${d.unit==='pkr'?'selected':''}>PKR</option></select></div>
                <button class="btn btn-icon btn-danger btn-sm" onclick="Selling.removeDeduction(${d.id})">×</button>
            </div>
        `).join('');
    },

    updateDed(id, field, val) {
        const d = this.additionalDeductions.find(x => x.id === id);
        if (d) d[field] = field === 'amount' ? Utils.pf(val) : val;
    },

    calculate() {
        const grossWeight = Utils.pf(document.getElementById('s-weight').value);
        const perBag = Utils.pf(document.getElementById('s-per-bag').value) || 100;
        document.getElementById('s-bags-display').textContent = Utils.formatNum(grossWeight / perBag, 2);

        let kgDed = 0, pkrDed = 0;
        this.additionalDeductions.forEach(d => {
            if (d.unit === 'kg') kgDed += d.amount;
            else pkrDed += d.amount;
        });

        const netWeight = Math.max(0, grossWeight - kgDed);
        const netMn = netWeight / 40;
        const rate = Utils.pf(document.getElementById('s-rate').value);
        const amount = netMn * rate - pkrDed;

        document.getElementById('s-net-weight').textContent = Utils.formatNum(netWeight, 2) + ' KG';
        document.getElementById('s-net-mn').textContent = Utils.formatNum(netMn, 2);
        document.getElementById('s-amount').textContent = 'PKR ' + Utils.formatPKR(Math.max(0, amount));
    },

    async handleImage(event) {
        const file = event.target.files[0];
        if (!file) return;
        let base64 = await Utils.fileToBase64(file);
        base64 = await Utils.compressImage(base64, 800, 0.7);
        this.receiptImage = base64;
        document.getElementById('s-receipt-area').innerHTML = `<img src="${base64}" alt="Receipt"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();Selling.removeImage()" style="position:absolute;top:8px;right:8px">×</button>`;
        document.getElementById('s-receipt-area').style.position = 'relative';
    },

    removeImage() {
        this.receiptImage = null;
        document.getElementById('s-receipt-image').value = '';
        document.getElementById('s-receipt-area').innerHTML = `<i data-lucide="image-plus" style="width:32px;height:32px;color:var(--text-muted)"></i><span class="upload-text">Click to upload buyer receipt</span>`;
        lucide.createIcons();
    },

    getData() {
        const grossWeight = Utils.pf(document.getElementById('s-weight').value);
        const perBag = Utils.pf(document.getElementById('s-per-bag').value) || 100;
        let kgDed = 0, pkrDed = 0;
        this.additionalDeductions.forEach(d => { if (d.unit === 'kg') kgDed += d.amount; else pkrDed += d.amount; });
        const netWeight = Math.max(0, grossWeight - kgDed);
        const netMn = netWeight / 40;
        const rate = Utils.pf(document.getElementById('s-rate').value);
        const amount = Math.max(0, netMn * rate - pkrDed);
        const paymentStatus = document.getElementById('s-payment-status').value;
        let amountReceived = Utils.pf(document.getElementById('s-amount-received').value);
        if (paymentStatus === 'paid') amountReceived = amount;

        return {
            id: document.getElementById('s-id').value, buyerName: document.getElementById('s-buyer').value.trim(),
            date: document.getElementById('s-date').value, crop: document.getElementById('s-crop').value,
            grossWeight, perBag, perBagWeight: perBag, deductions: this.additionalDeductions, kgDeductions: kgDed, pkrDeductions: pkrDed,
            netWeight, netMn, rate, amount, paymentStatus, amountReceived,
            balance: amount - amountReceived, notes: document.getElementById('s-notes').value.trim(),
            receiptImage: this.receiptImage, createdAt: new Date().toISOString()
        };
    },

    async save() {
        const d = this.getData();
        if (!d.buyerName) { Utils.showToast('Buyer name required', 'error'); return; }
        if (!d.crop) { Utils.showToast('Crop required', 'error'); return; }
        if (d.grossWeight <= 0) { Utils.showToast('Weight required', 'error'); return; }
        await DB.put('sales', d);
        await Utils.confirmReceiptId('sale', d.id);
        await Buyers.ensureBuyer(d.buyerName);
        Utils.showToast('Sale receipt saved!');
        this.clearForm();
        return d;
    },

    async saveAndPrint() {
        const d = await this.save();
        if (d) {
            Utils.showLoading('Generating PDF...');
            await ReceiptPDF.generateSale(d);
            Utils.hideLoading();
        }
    },

    async clearForm() {
        this.editingId = null;
        this.additionalDeductions = [];
        this.receiptImage = null;
        document.getElementById('s-id').value = await Utils.getNextReceiptId('sale');
        document.getElementById('s-date').value = Utils.todayISO();
        document.getElementById('s-buyer').value = '';
        document.getElementById('s-crop').value = '';
        document.getElementById('s-weight').value = '';
        document.getElementById('s-rate').value = '';
        document.getElementById('s-amount-received').value = '0';
        document.getElementById('s-payment-status').value = 'pending';
        document.getElementById('s-notes').value = '';
        this.renderDeductions();
        this.removeImage();
        this.calculate();
        await this.loadBuyerDatalist();
    },

    async loadForEdit(id) {
        const data = await DB.get('sales', id);
        if (!data) return;
        this.editingId = id;
        document.getElementById('s-id').value = data.id;
        document.getElementById('s-date').value = data.date;
        document.getElementById('s-buyer').value = data.buyerName;
        document.getElementById('s-crop').value = data.crop;
        document.getElementById('s-weight').value = data.grossWeight;
        document.getElementById('s-per-bag').value = data.perBag || data.perBagWeight || 100;
        document.getElementById('s-rate').value = data.rate;
        document.getElementById('s-payment-status').value = data.paymentStatus;
        document.getElementById('s-amount-received').value = data.amountReceived || 0;
        document.getElementById('s-notes').value = data.notes || '';

        this.additionalDeductions = (data.deductions || data.additionalDeductions || []).map(d => ({ ...d, id: d.id || Date.now() + Math.random() }));
        this.renderDeductions();
        if (data.receiptImage) {
            this.receiptImage = data.receiptImage;
            document.getElementById('s-receipt-area').innerHTML = `<img src="${data.receiptImage}" alt="Receipt"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();Selling.removeImage()" style="position:absolute;top:8px;right:8px">×</button>`;
            document.getElementById('s-receipt-area').style.position = 'relative';
        }
        this.calculate();
        App.navigate('selling');
    }
};

// ===== Sale List =====
const SaleList = {
    currentPage: 1,
    async render(page) {
        if (page) this.currentPage = page;
        const all = await DB.getAll('sales');
        const search = (document.getElementById('sl-search').value || '').toLowerCase();
        const statusFilter = document.getElementById('sl-status-filter').value;
        let filtered = all.filter(s => {
            if (search && !s.buyerName.toLowerCase().includes(search) && !s.id.toLowerCase().includes(search) && !(s.crop||'').toLowerCase().includes(search)) return false;
            if (statusFilter && s.paymentStatus !== statusFilter) return false;
            return true;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        const { items, page: p, totalPages } = Utils.paginate(filtered, this.currentPage, 25);
        this.currentPage = p;

        document.getElementById('sale-tbody').innerHTML = items.map(s => `<tr>
            <td class="font-bold">${Utils.highlightText(s.id, search)}</td><td>${Utils.formatDate(s.date)}</td><td class="font-bold">${Utils.highlightText(s.buyerName, search)}</td>
            <td>${Utils.highlightText(s.crop, search)}</td><td>${Utils.formatNum(s.netWeight)} KG</td><td>PKR ${Utils.formatPKR(s.rate)}</td>
            <td class="text-right font-bold">PKR ${Utils.formatPKR(s.amount)}</td>
            <td>${Utils.statusBadge(s.paymentStatus)}</td>
            <td><div class="table-actions">
                <button class="btn btn-icon btn-ghost btn-sm" onclick="Selling.loadForEdit('${s.id}')" title="Edit">✏️</button>
                <button class="btn btn-icon btn-ghost btn-sm" onclick="ReceiptPDF.generateSale(null,'${s.id}')" title="PDF">📄</button>
                <button class="btn btn-icon btn-danger btn-sm" onclick="SaleList.delete('${s.id}')" title="Delete">🗑️</button>
            </div></td>
        </tr>`).join('') || '<tr><td colspan="9" class="text-center" style="color:var(--text-muted)">No sales yet</td></tr>';

        Utils.renderPagination('sale-pagination', this.currentPage, totalPages, 'SaleList.render');
    },
    async delete(id) {
        if (!await Utils.confirm('Delete this sale and its associated payments?')) return;
        // Cascade delete sale payments
        const payments = await DB.getByIndex('sale_payments', 'saleId', id);
        for (const p of payments) await DB.delete('sale_payments', p.id);
        await DB.delete('sales', id);
        Utils.showToast('Deleted!');
        this.render();
    },
    goToPage(page) { this.currentPage = page; this.render(); }
};

const SaleExport = {
    async toExcel() {
        const all = await DB.getAll('sales');
        if (!all.length) { Utils.showToast('No data', 'warning'); return; }
        const rows = all.map(s => ({ 'ID': s.id, 'Date': s.date, 'Buyer': s.buyerName, 'Crop': s.crop, 'Gross (KG)': s.grossWeight, 'Net (KG)': s.netWeight, 'Rate/Mn': s.rate, 'Amount': s.amount, 'Received': s.amountReceived, 'Balance': s.balance, 'Status': s.paymentStatus }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sales');
        XLSX.writeFile(wb, `Sales_${Utils.todayISO()}.xlsx`);
        Utils.showToast('Excel exported!');
    }
};
