// ===== AgriSys IndexedDB Data Layer =====

const DB = {
    db: null,
    DB_NAME: 'AgriSysDB',
    DB_VERSION: 3,

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;

                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // Purchases store
                if (!db.objectStoreNames.contains('purchases')) {
                    const store = db.createObjectStore('purchases', { keyPath: 'id' });
                    store.createIndex('date', 'date');
                    store.createIndex('farmerName', 'farmerName');
                    store.createIndex('crop', 'crop');
                    store.createIndex('paymentStatus', 'paymentStatus');
                }

                // Farmers store
                if (!db.objectStoreNames.contains('farmers')) {
                    const store = db.createObjectStore('farmers', { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                }

                // Purchase Payments store
                if (!db.objectStoreNames.contains('purchase_payments')) {
                    const store = db.createObjectStore('purchase_payments', { keyPath: 'id' });
                    store.createIndex('purchaseId', 'purchaseId');
                    store.createIndex('farmerName', 'farmerName');
                    store.createIndex('date', 'date');
                }

                // Sales store
                if (!db.objectStoreNames.contains('sales')) {
                    const store = db.createObjectStore('sales', { keyPath: 'id' });
                    store.createIndex('date', 'date');
                    store.createIndex('buyerName', 'buyerName');
                    store.createIndex('crop', 'crop');
                    store.createIndex('paymentStatus', 'paymentStatus');
                }

                // Sale Payments store
                if (!db.objectStoreNames.contains('sale_payments')) {
                    const store = db.createObjectStore('sale_payments', { keyPath: 'id' });
                    store.createIndex('saleId', 'saleId');
                    store.createIndex('buyerName', 'buyerName');
                    store.createIndex('date', 'date');
                }

                // Expenses store
                if (!db.objectStoreNames.contains('expenses')) {
                    const store = db.createObjectStore('expenses', { keyPath: 'id' });
                    store.createIndex('date', 'date');
                    store.createIndex('type', 'type');
                    store.createIndex('crop', 'crop');
                    store.createIndex('purchaseId', 'purchaseId');
                }

                // Capital Accounts store
                if (!db.objectStoreNames.contains('capital_accounts')) {
                    db.createObjectStore('capital_accounts', { keyPath: 'id' });
                }

                // Capital Transactions store
                if (!db.objectStoreNames.contains('capital_transactions')) {
                    const store = db.createObjectStore('capital_transactions', { keyPath: 'id' });
                    store.createIndex('accountId', 'accountId');
                    store.createIndex('date', 'date');
                }

                // V2: Buyers store
                if (!db.objectStoreNames.contains('buyers')) {
                    const store = db.createObjectStore('buyers', { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                }

                // V3: Farmer Advances store
                if (!db.objectStoreNames.contains('farmer_advances')) {
                    const store = db.createObjectStore('farmer_advances', { keyPath: 'id' });
                    store.createIndex('farmerName', 'farmerName');
                    store.createIndex('date', 'date');
                }
            };

            request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // Generic CRUD
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(data);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const req = index.getAll(value);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async count(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    // Settings helpers
    async getSetting(key) {
        const record = await this.get('settings', key);
        return record ? record.value : null;
    },

    async setSetting(key, value) {
        return this.put('settings', { key, value });
    },

    // Backup all data
    async exportAll() {
        const stores = ['settings', 'purchases', 'farmers', 'purchase_payments', 'sales', 'sale_payments', 'expenses', 'capital_accounts', 'capital_transactions', 'buyers', 'farmer_advances'];
        const data = {};
        for (const s of stores) {
            data[s] = await this.getAll(s);
        }
        data._exportDate = new Date().toISOString();
        data._version = this.DB_VERSION;
        return data;
    },

    // Restore all data
    async importAll(data) {
        const stores = ['settings', 'purchases', 'farmers', 'purchase_payments', 'sales', 'sale_payments', 'expenses', 'capital_accounts', 'capital_transactions', 'buyers', 'farmer_advances'];
        for (const s of stores) {
            if (data[s]) {
                await this.clear(s);
                for (const record of data[s]) {
                    await this.put(s, record);
                }
            }
        }
    }
};
