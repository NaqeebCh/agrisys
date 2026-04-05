// ===== Settings Module =====
const Settings = {
    defaults: {
        bizName: '',
        address: '',
        phone: '',
        crops: 'Wheat,Rice,Cotton,Potato,Maize,Sugarcane,Misc',
        expenseTypes: 'Labour,Transport,Diesel,Rent,Utility,Misc',
        perBagWeight: 100,
        defaultBardana: 1,
        defaultLabour: 0.5
    },

    async init() {
        const biz = await DB.getSetting('business');
        const defs = await DB.getSetting('defaults');
        if (biz) {
            document.getElementById('set-biz-name').value = biz.bizName || '';
            document.getElementById('set-address').value = biz.address || '';
            document.getElementById('set-phone').value = biz.phone || '';
            document.getElementById('set-owner-name').value = biz.ownerName || '';
            document.getElementById('set-crops').value = biz.crops || '';
            document.getElementById('set-expense-types').value = biz.expenseTypes || this.defaults.expenseTypes;
        } else {
            document.getElementById('set-biz-name').value = '';
            document.getElementById('set-address').value = '';
            document.getElementById('set-phone').value = '';
            document.getElementById('set-owner-name').value = '';
            document.getElementById('set-crops').value = this.defaults.crops;
            document.getElementById('set-expense-types').value = this.defaults.expenseTypes;
        }
        if (defs) {
            document.getElementById('set-per-bag').value = defs.perBagWeight || 100;
            document.getElementById('set-bardana').value = defs.defaultBardana || 1;
            document.getElementById('set-labour').value = defs.defaultLabour || 0.5;
        }
        return !!biz;
    },

    async getBusiness() {
        const biz = await DB.getSetting('business');
        return biz || { ...this.defaults, isNew: true };
    },

    async getDefaults() {
        const defs = await DB.getSetting('defaults');
        return defs || { perBagWeight: 100, defaultBardana: 1, defaultLabour: 0.5 };
    },

    async getCrops() {
        const biz = await this.getBusiness();
        const str = biz.crops || this.defaults.crops;
        return str.split(',').map(c => c.trim()).filter(c => c);
    },

    async getExpenseTypes() {
        const biz = await this.getBusiness();
        const str = biz.expenseTypes || this.defaults.expenseTypes;
        return str.split(',').map(c => c.trim()).filter(c => c);
    },

    async save() {
        const data = {
            bizName: document.getElementById('set-biz-name').value.trim(),
            address: document.getElementById('set-address').value.trim(),
            phone: document.getElementById('set-phone').value.trim(),
            ownerName: document.getElementById('set-owner-name').value.trim(),
            crops: document.getElementById('set-crops').value.trim(),
            expenseTypes: document.getElementById('set-expense-types').value.trim()
        };
        await DB.setSetting('business', data);
        
        // Update sidebar branding
        document.getElementById('sidebar-biz-name').textContent = data.bizName || 'AgriSys';
        
        Utils.showToast('Business settings saved!');
        App.populateCropSelects();
        App.populateExpenseTypeSelect();
    },

    async saveDefaults() {
        const data = {
            perBagWeight: Utils.pf(document.getElementById('set-per-bag').value),
            defaultBardana: Utils.pf(document.getElementById('set-bardana').value),
            defaultLabour: Utils.pf(document.getElementById('set-labour').value)
        };
        await DB.setSetting('defaults', data);
        Utils.showToast('Default values saved!');
    },

    async backup() {
        try {
            Utils.showLoading('Creating backup...');
            const data = await DB.exportAll();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AgriSys_Backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            Utils.hideLoading();
            Utils.showToast('Backup downloaded!');
        } catch (e) { Utils.hideLoading(); Utils.showToast('Backup failed: ' + e.message, 'error'); }
    },

    async restore(event) {
        const file = event.target.files[0];
        if (!file) return;
        const ok = await Utils.confirm('This will replace ALL current data. Are you sure?');
        if (!ok) return;
        try {
            Utils.showLoading('Restoring data...');
            const text = await file.text();
            const data = JSON.parse(text);
            await DB.importAll(data);
            Utils.hideLoading();
            Utils.showToast('Data restored! Reloading...');
            setTimeout(() => location.reload(), 1500);
        } catch (e) { Utils.hideLoading(); Utils.showToast('Restore failed: ' + e.message, 'error'); }
        event.target.value = '';
    },

    async clearAll() {
        const ok = await Utils.confirm('This will DELETE ALL DATA permanently. Are you sure?');
        if (!ok) return;
        const stores = ['settings','purchases','farmers','purchase_payments','sales','sale_payments','expenses','capital_accounts','capital_transactions','buyers'];
        for (const s of stores) await DB.clear(s);
        Utils.showToast('All data cleared! Reloading...');
        setTimeout(() => location.reload(), 1500);
    }
};
