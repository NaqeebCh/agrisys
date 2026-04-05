// ===== Export Utilities =====
const ExportUtils = {
    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    },

    async allToExcel() {
        Utils.showLoading('Creating full Excel backup...');
        const purchases = await DB.getAll('purchases');
        const sales = await DB.getAll('sales');
        const expenses = await DB.getAll('expenses');
        const farmers = await DB.getAll('farmers');
        const buyers = await DB.getAll('buyers');

        const wb = XLSX.utils.book_new();

        if (purchases.length) {
            const ps = purchases.map(p => ({
                ID: p.id, Date: p.date, Farmer: p.farmerName, Crop: p.crop,
                'Gross (KG)': p.grossWeight, 'Net (KG)': p.netWeight, 'Rate/Mn': p.rate,
                Amount: p.amount, 'Net Payable': p.netPayableAmount, Paid: p.amountPaid,
                Balance: p.balance, Status: p.paymentStatus
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ps), 'Purchases');
        }

        if (sales.length) {
            const ss = sales.map(s => ({
                ID: s.id, Date: s.date, Buyer: s.buyerName, Crop: s.crop,
                'Gross (KG)': s.grossWeight, 'Net (KG)': s.netWeight, 'Rate/Mn': s.rate,
                Amount: s.amount, Received: s.amountReceived, Balance: s.balance, Status: s.paymentStatus
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ss), 'Sales');
        }

        if (expenses.length) {
            const es = expenses.map(e => ({
                ID: e.id, Date: e.date, Type: e.type, Description: e.description,
                Crop: e.crop, 'Linked Receipt': e.purchaseId, Amount: e.amount
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(es), 'Expenses');
        }

        if (farmers.length) {
            const fs = farmers.map(f => ({ Name: f.name, Phone: f.phone, Address: f.address }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fs), 'Farmers');
        }

        if (buyers.length) {
            const bs = buyers.map(b => ({ Name: b.name, Phone: b.phone, Address: b.address }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bs), 'Buyers');
        }

        XLSX.writeFile(wb, `AgriSys_Full_${Utils.todayISO()}.xlsx`);
        Utils.hideLoading();
        Utils.showToast('Full export complete!');
    }
};
