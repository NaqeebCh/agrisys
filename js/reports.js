// ===== Reports Module — Professional P&L & Business Summary =====
const Reports = {

    // ── Shared PDF Header ──
    drawReportHeader(doc, biz, title, from, to) {
        // Business name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text((biz.bizName || 'AgriSys').toUpperCase(), 105, 15, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(biz.address || 'Agricultural Business Management', 105, 21, { align: 'center' });
        if (biz.phone) doc.text('Phone: ' + biz.phone, 105, 25, { align: 'center' });
        if (biz.ownerName) doc.text('Proprietor: ' + biz.ownerName, 105, 29, { align: 'center' });

        const headerEnd = biz.ownerName ? 31 : 27;

        // Double rule
        doc.setLineWidth(0.8);
        doc.line(15, headerEnd, 195, headerEnd);
        doc.setLineWidth(0.3);
        doc.line(15, headerEnd + 1, 195, headerEnd + 1);

        // Report title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(title, 105, headerEnd + 8, { align: 'center' });

        // Thin line
        doc.setLineWidth(0.15);
        doc.line(15, headerEnd + 11, 195, headerEnd + 11);

        // Period
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`For the Period: ${Utils.formatDate(from)} to ${Utils.formatDate(to)}`, 105, headerEnd + 17, { align: 'center' });

        doc.setLineWidth(0.15);
        doc.line(15, headerEnd + 20, 195, headerEnd + 20);

        return headerEnd + 28;
    },

    // ═══════════════════════════════════════════════
    // IN-APP REPORT GENERATION
    // ═══════════════════════════════════════════════
    currentTab: 'pnl',

    switchTab(tab) {
        this.currentTab = tab;
        document.getElementById('tab-pnl').className = tab === 'pnl' ? 'btn btn-primary' : 'btn btn-ghost';
        document.getElementById('tab-bs').className = tab === 'bs' ? 'btn btn-primary' : 'btn btn-ghost';
        document.getElementById('tab-cf').className = tab === 'cf' ? 'btn btn-primary' : 'btn btn-ghost';
        
        const exportActions = document.getElementById('rp-actions');
        if (exportActions) {
            exportActions.style.display = tab === 'pnl' ? 'flex' : 'none';
        }
        this.generate();
    },

    async generate() {
        if (this.currentTab === 'pnl') return this.generatePnL();
        if (this.currentTab === 'bs') return this.generateBalanceSheet();
        if (this.currentTab === 'cf') return this.generateCashFlow();
    },

    async generatePnL() {
        const from = document.getElementById('rp-from').value;
        const to = document.getElementById('rp-to').value;
        if (!from || !to) { Utils.showToast('Select date range', 'warning'); return; }

        const purchases = (await DB.getAll('purchases')).filter(p => p.date >= from && p.date <= to);
        const sales = (await DB.getAll('sales')).filter(s => s.date >= from && s.date <= to);
        const expenses = (await DB.getAll('expenses')).filter(e => e.date >= from && e.date <= to);
        const pPayments = (await DB.getAll('purchase_payments')).filter(p => p.date >= from && p.date <= to);
        const sPayments = (await DB.getAll('sale_payments')).filter(p => p.date >= from && p.date <= to);

        // ── Core Calculations ──
        const totalRevenue = sales.reduce((s, x) => s + (x.amount || 0), 0);
        const totalCOGS = purchases.reduce((s, p) => s + (p.netPayableAmount || p.amount || 0), 0);
        const grossProfit = totalRevenue - totalCOGS;
        const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        const netProfit = grossProfit - totalExpenses;
        const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';
        const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

        // Cash Flow
        const paidToFarmers = pPayments.reduce((s, p) => s + (p.amount || 0), 0);
        const initialPaidToFarmers = purchases.reduce((s, p) => s + (p.amountPaid || 0), 0);
        const totalPaidOut = paidToFarmers + initialPaidToFarmers;  // Note: might double count, use paidToFarmers for cash flow
        const receivedFromBuyers = sPayments.reduce((s, p) => s + (p.amount || 0), 0);
        const initialReceivedFromBuyers = sales.reduce((s, p) => s + (p.amountReceived || 0), 0);

        // Outstanding
        const totalFarmerPayable = totalCOGS;
        const totalFarmerPaid = purchases.reduce((s, p) => s + (p.amountPaid || 0), 0);
        const farmerBalance = totalFarmerPayable - totalFarmerPaid;

        const totalBuyerReceivable = totalRevenue;
        const totalBuyerReceived = sales.reduce((s, p) => s + (p.amountReceived || 0), 0);
        const buyerBalance = totalBuyerReceivable - totalBuyerReceived;

        // Expense breakdown
        const expByType = {};
        expenses.forEach(e => { expByType[e.type] = (expByType[e.type] || 0) + e.amount; });

        // Crop-wise breakdown
        const crops = [...new Set([...purchases.map(p => p.crop), ...sales.map(s => s.crop)].filter(Boolean))];
        const cropData = crops.map(crop => {
            const cPurchases = purchases.filter(p => p.crop === crop);
            const cSales = sales.filter(s => s.crop === crop);
            const cExpenses = expenses.filter(e => e.crop === crop);
            const revenue = cSales.reduce((s, x) => s + (x.amount || 0), 0);
            const cost = cPurchases.reduce((s, p) => s + (p.netPayableAmount || p.amount || 0), 0);
            const exp = cExpenses.reduce((s, e) => s + (e.amount || 0), 0);
            const boughtWeight = cPurchases.reduce((s, p) => s + (p.netWeight || 0), 0);
            const soldWeight = cSales.reduce((s, p) => s + (p.netWeight || 0), 0);
            const avgBuyRate = boughtWeight > 0 ? cost / (boughtWeight / 40) : 0;
            const avgSellRate = soldWeight > 0 ? revenue / (soldWeight / 40) : 0;
            return { crop, revenue, cost, expenses: exp, profit: revenue - cost - exp, boughtWeight, soldWeight, avgBuyRate, avgSellRate };
        });

        const container = document.getElementById('report-content');
        container.innerHTML = `
            <!-- Key Metrics -->
            <div class="stats-grid">
                <div class="stat-card green"><div class="stat-label">Total Revenue</div><div class="stat-value">PKR ${Utils.formatPKR(totalRevenue)}</div><div class="stat-sub">${sales.length} sales · Avg: PKR ${Utils.formatPKR(sales.length > 0 ? totalRevenue / sales.length : 0)}</div></div>
                <div class="stat-card blue"><div class="stat-label">Cost of Goods</div><div class="stat-value">PKR ${Utils.formatPKR(totalCOGS)}</div><div class="stat-sub">${purchases.length} purchases · Avg: PKR ${Utils.formatPKR(purchases.length > 0 ? totalCOGS / purchases.length : 0)}</div></div>
                <div class="stat-card ${grossProfit >= 0 ? 'green' : 'orange'}"><div class="stat-label">Gross Profit</div><div class="stat-value">PKR ${Utils.formatPKR(grossProfit)}</div><div class="stat-sub">Margin: ${grossMargin}%</div></div>
                <div class="stat-card ${netProfit >= 0 ? 'green' : 'orange'}"><div class="stat-label">Net Profit</div><div class="stat-value">PKR ${Utils.formatPKR(netProfit)}</div><div class="stat-sub">Margin: ${netMargin}% · Expenses: PKR ${Utils.formatPKR(totalExpenses)}</div></div>
            </div>

            <!-- P&L Statement -->
            <div class="card" style="margin-bottom:20px">
                <div class="card-header"><h3 class="card-title">Profit & Loss Statement</h3><span style="color:var(--text-muted);font-size:0.8rem">${Utils.formatDate(from)} — ${Utils.formatDate(to)}</span></div>
                <div class="summary-box">
                    <div class="summary-row"><span class="summary-label"><strong>Sales Revenue</strong></span><span class="summary-value" style="color:var(--accent-success)">PKR ${Utils.formatPKR(totalRevenue)}</span></div>
                    <div class="summary-row"><span class="summary-label">Less: Cost of Goods Purchased</span><span class="summary-value" style="color:var(--accent-danger)">( PKR ${Utils.formatPKR(totalCOGS)} )</span></div>
                    <div class="summary-row total"><span class="summary-label">Gross Profit</span><span class="summary-value" style="color:${grossProfit >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}">PKR ${Utils.formatPKR(grossProfit)}</span></div>
                    ${Object.entries(expByType).map(([t, a]) => `<div class="summary-row"><span class="summary-label" style="padding-left:12px">• ${t.charAt(0).toUpperCase() + t.slice(1)}</span><span class="summary-value" style="color:var(--accent-danger)">( PKR ${Utils.formatPKR(a)} )</span></div>`).join('')}
                    <div class="summary-row"><span class="summary-label"><strong>Total Operating Expenses</strong></span><span class="summary-value" style="color:var(--accent-danger)">( PKR ${Utils.formatPKR(totalExpenses)} )</span></div>
                    <div class="summary-row total"><span class="summary-label"><strong>Net Profit / (Loss)</strong></span><span class="summary-value" style="color:${netProfit >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}; font-size:1.4rem"><strong>PKR ${Utils.formatPKR(netProfit)}</strong></span></div>
                </div>
            </div>

            <!-- Outstanding Balances -->
            <div class="stats-grid" style="margin-bottom:20px">
                <div class="stat-card orange"><div class="stat-label">Payable to Farmers</div><div class="stat-value">PKR ${Utils.formatPKR(farmerBalance)}</div><div class="stat-sub">Paid: PKR ${Utils.formatPKR(totalFarmerPaid)} of PKR ${Utils.formatPKR(totalFarmerPayable)}</div></div>
                <div class="stat-card purple"><div class="stat-label">Receivable from Buyers</div><div class="stat-value">PKR ${Utils.formatPKR(buyerBalance)}</div><div class="stat-sub">Received: PKR ${Utils.formatPKR(totalBuyerReceived)} of PKR ${Utils.formatPKR(totalBuyerReceivable)}</div></div>
            </div>

            <!-- Crop Profitability -->
            <div class="card">
                <div class="card-header"><h3 class="card-title">Crop-wise Profitability</h3></div>
                <div class="table-container"><table class="data-table">
                    <thead><tr><th>Crop</th><th class="text-right">Bought (KG)</th><th class="text-right">Avg Buy Rate</th><th class="text-right">Sold (KG)</th><th class="text-right">Avg Sell Rate</th><th class="text-right">Revenue</th><th class="text-right">Cost</th><th class="text-right">Expenses</th><th class="text-right">Profit</th></tr></thead>
                    <tbody>${cropData.map(c => `<tr>
                        <td class="font-bold">${c.crop}</td>
                        <td class="text-right">${Utils.formatNum(c.boughtWeight, 0)}</td>
                        <td class="text-right">PKR ${Utils.formatPKR(c.avgBuyRate)}</td>
                        <td class="text-right">${Utils.formatNum(c.soldWeight, 0)}</td>
                        <td class="text-right">PKR ${Utils.formatPKR(c.avgSellRate)}</td>
                        <td class="text-right">PKR ${Utils.formatPKR(c.revenue)}</td>
                        <td class="text-right">PKR ${Utils.formatPKR(c.cost)}</td>
                        <td class="text-right">PKR ${Utils.formatPKR(c.expenses)}</td>
                        <td class="text-right font-bold" style="color:${c.profit >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}">PKR ${Utils.formatPKR(c.profit)}</td>
                    </tr>`).join('')}
                    <tr style="border-top:2px solid var(--accent-primary)">
                        <td class="font-bold">TOTAL</td>
                        <td class="text-right font-bold">${Utils.formatNum(cropData.reduce((s, c) => s + c.boughtWeight, 0), 0)}</td>
                        <td></td>
                        <td class="text-right font-bold">${Utils.formatNum(cropData.reduce((s, c) => s + c.soldWeight, 0), 0)}</td>
                        <td></td>
                        <td class="text-right font-bold">PKR ${Utils.formatPKR(totalRevenue)}</td>
                        <td class="text-right font-bold">PKR ${Utils.formatPKR(totalCOGS)}</td>
                        <td class="text-right font-bold">PKR ${Utils.formatPKR(totalExpenses)}</td>
                        <td class="text-right font-bold" style="color:${netProfit >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}">PKR ${Utils.formatPKR(netProfit)}</td>
                    </tr></tbody>
                </table></div>
            </div>
        `;
    },

    async generateBalanceSheet() {
        const toDate = document.getElementById('rp-to').value;
        if (!toDate) { Utils.showToast('Select end date', 'warning'); return; }

        const allSales = (await DB.getAll('sales')).filter(x => x.date <= toDate);
        const allSalePayments = (await DB.getAll('sale_payments')).filter(x => x.date <= toDate);
        const allPurchases = (await DB.getAll('purchases')).filter(x => x.date <= toDate);
        const allPurchasePayments = (await DB.getAll('purchase_payments')).filter(x => x.date <= toDate);
        const allAdvances = (await DB.getAll('farmer_advances')).filter(x => x.date <= toDate);
        const allAccs = await DB.getAll('capital_accounts');
        const allCapTx = (await DB.getAll('capital_transactions')).filter(x => x.date <= toDate);

        // Assets
        // 1. Accounts Receivable
        const totalSalesRevenue = allSales.reduce((s, x) => s + (x.amount || 0), 0);
        const initialSalesReceived = allSales.reduce((s, x) => s + (x.amountReceived || 0), 0);
        const laterSalesReceived = allSalePayments.reduce((s, x) => s + (x.amount || 0), 0);
        const accountsReceivable = totalSalesRevenue - initialSalesReceived - laterSalesReceived;

        // 2. Farmer Advances
        const farmerAdvances = allAdvances.reduce((s, a) => s + (a.amount || 0), 0);
        
        // 3. Cash & Bank
        let totalCashBank = 0;
        const bankBalances = allAccs.map(acc => {
            const txs = allCapTx.filter(t => t.accountId === acc.id);
            const deps = txs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
            const wids = txs.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
            const bal = (acc.openingBalance || 0) + deps - wids;
            totalCashBank += bal;
            return { name: acc.name, balance: bal };
        });

        const totalAssets = accountsReceivable + farmerAdvances + totalCashBank;

        // Liabilities
        // Accounts Payable
        const totalPurchasesCost = allPurchases.reduce((s, p) => s + (p.netPayableAmount || p.amount || 0), 0);
        const initialPurchasesPaid = allPurchases.reduce((s, p) => s + (p.amountPaid || 0), 0);
        const laterPurchasesPaid = allPurchasePayments.reduce((s, x) => s + (x.amount || 0), 0);
        const accountsPayable = totalPurchasesCost - initialPurchasesPaid - laterPurchasesPaid;
        const totalLiabilities = accountsPayable;

        // Equity
        const netEquity = totalAssets - totalLiabilities;

        const container = document.getElementById('report-content');
        container.innerHTML = `
            <div class="card" style="margin-bottom:20px; max-width: 800px; margin: 0 auto;">
                <div class="card-header"><h3 class="card-title">Balance Sheet</h3><span style="color:var(--text-muted);font-size:0.8rem">As of ${Utils.formatDate(toDate)}</span></div>
                <div class="summary-box">
                    <div class="summary-row total"><span class="summary-label"><strong>ASSETS</strong></span></div>
                    
                    <div class="summary-row"><span class="summary-label" style="padding-left:12px; font-weight:bold;">Current Assets</span><span></span></div>
                    <div class="summary-row"><span class="summary-label" style="padding-left:24px">Accounts Receivable (Buyers)</span><span class="summary-value">PKR ${Utils.formatPKR(accountsReceivable)}</span></div>
                    <div class="summary-row"><span class="summary-label" style="padding-left:24px">Advances to Farmers</span><span class="summary-value">PKR ${Utils.formatPKR(farmerAdvances)}</span></div>
                    <div class="summary-row"><span class="summary-label" style="padding-left:24px">Cash & Equivalent</span><span class="summary-value">PKR ${Utils.formatPKR(totalCashBank)}</span></div>
                    ${bankBalances.map(b => `<div class="summary-row"><span class="summary-label" style="padding-left:36px; font-size:0.85rem; color:var(--text-muted)">- ${b.name}</span><span class="summary-value" style="font-size:0.85rem; color:var(--text-muted)">PKR ${Utils.formatPKR(b.balance)}</span></div>`).join('')}
                    
                    <div class="summary-row" style="border-top: 1px solid var(--border-color); margin-top: 8px;"><span class="summary-label"><strong>Total Assets</strong></span><span class="summary-value" style="color:var(--accent-primary)"><strong>PKR ${Utils.formatPKR(totalAssets)}</strong></span></div>
                    
                    <div style="height:20px;"></div>

                    <div class="summary-row total"><span class="summary-label"><strong>LIABILITIES & EQUITY</strong></span></div>
                    
                    <div class="summary-row"><span class="summary-label" style="padding-left:12px; font-weight:bold;">Liabilities</span><span></span></div>
                    <div class="summary-row"><span class="summary-label" style="padding-left:24px">Accounts Payable (Farmers)</span><span class="summary-value">PKR ${Utils.formatPKR(accountsPayable)}</span></div>
                    <div class="summary-row" style="border-top: 1px solid var(--border-color); margin-top: 8px;"><span class="summary-label"><strong>Total Liabilities</strong></span><span class="summary-value" style="color:var(--accent-danger)"><strong>PKR ${Utils.formatPKR(totalLiabilities)}</strong></span></div>
                    
                    <div style="height:10px;"></div>
                    
                    <div class="summary-row"><span class="summary-label" style="padding-left:12px; font-weight:bold;">Equity</span><span></span></div>
                    <div class="summary-row"><span class="summary-label" style="padding-left:24px">Net Worth (Capital + Retained Earnings)</span><span class="summary-value">PKR ${Utils.formatPKR(netEquity)}</span></div>
                    <div class="summary-row" style="border-top: 1px solid var(--border-color); margin-top: 8px;"><span class="summary-label"><strong>Total Liabilities & Equity</strong></span><span class="summary-value" style="color:var(--accent-primary)"><strong>PKR ${Utils.formatPKR(totalLiabilities + netEquity)}</strong></span></div>
                </div>
            </div>
        `;
    },

    async generateCashFlow() {
        const fromDate = document.getElementById('rp-from').value;
        const toDate = document.getElementById('rp-to').value;
        if (!fromDate || !toDate) { Utils.showToast('Select date range', 'warning'); return; }

        const sales = (await DB.getAll('sales')).filter(x => x.date >= fromDate && x.date <= toDate);
        const salePayments = (await DB.getAll('sale_payments')).filter(x => x.date >= fromDate && x.date <= toDate);
        const purchases = (await DB.getAll('purchases')).filter(x => x.date >= fromDate && x.date <= toDate);
        const purchasePayments = (await DB.getAll('purchase_payments')).filter(x => x.date >= fromDate && x.date <= toDate);
        const advances = (await DB.getAll('farmer_advances')).filter(x => x.date >= fromDate && x.date <= toDate);
        const expenses = (await DB.getAll('expenses')).filter(x => x.date >= fromDate && x.date <= toDate);
        const capitalTxs = (await DB.getAll('capital_transactions')).filter(x => x.date >= fromDate && x.date <= toDate);

        // Operating Activities
        const cashFromSales = sales.reduce((s, x) => s + (x.amountReceived || 0), 0) + salePayments.reduce((s, x) => s + (x.amount || 0), 0);
        const cashToPurchases = purchases.reduce((s, p) => s + (p.amountPaid || 0), 0) + purchasePayments.reduce((s, x) => s + (x.amount || 0), 0);
        const cashToAdvances = advances.filter(a => a.amount > 0).reduce((s, a) => s + a.amount, 0); // Given advances only, deductions don't move cash directly typically, but if recovered via purchase it's non-cash. If repaid directly, it'd be cash but we don't have direct repayment UI yet.
        const cashToExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        
        const netOperatingCash = cashFromSales - cashToPurchases - cashToAdvances - cashToExpenses;

        // Financing Activities
        const capitalDeposits = capitalTxs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
        const capitalWithdrawals = capitalTxs.filter(t => t.type === 'withdrawal' && !t.description.toLowerCase().includes('advance')).reduce((s, t) => s + t.amount, 0);
        const netFinancingCash = capitalDeposits - capitalWithdrawals;

        const netCashFlow = netOperatingCash + netFinancingCash;

        const container = document.getElementById('report-content');
        container.innerHTML = `
            <div class="card" style="margin-bottom:20px; max-width: 800px; margin: 0 auto;">
                <div class="card-header"><h3 class="card-title">Cash Flow Statement</h3><span style="color:var(--text-muted);font-size:0.8rem">${Utils.formatDate(fromDate)} — ${Utils.formatDate(toDate)}</span></div>
                <div class="summary-box">
                    <div class="summary-row total"><span class="summary-label"><strong>CASH FLOWS FROM OPERATING ACTIVITIES</strong></span></div>
                    
                    <div class="summary-row"><span class="summary-label" style="padding-left:24px">Cash received from Buyers</span><span class="summary-value" style="color:var(--accent-success)">PKR ${Utils.formatPKR(cashFromSales)}</span></div>
                    <div class="summary-row"><span class="summary-label" style="padding-left:24px">Cash paid to Farmers</span><span class="summary-value" style="color:var(--accent-danger)">( PKR ${Utils.formatPKR(cashToPurchases)} )</span></div>
                    <div class="summary-row"><span class="summary-label" style="padding-left:24px">Advances given to Farmers</span><span class="summary-value" style="color:var(--accent-danger)">( PKR ${Utils.formatPKR(cashToAdvances)} )</span></div>
                    <div class="summary-row"><span class="summary-label" style="padding-left:24px">Operating Expenses Paid</span><span class="summary-value" style="color:var(--accent-danger)">( PKR ${Utils.formatPKR(cashToExpenses)} )</span></div>
                    
                    <div class="summary-row" style="border-top: 1px solid var(--border-color); margin-top: 8px;"><span class="summary-label"><strong>Net Cash from Operating Activities</strong></span><span class="summary-value" style="color:${netOperatingCash >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}"><strong>PKR ${Utils.formatPKR(Math.abs(netOperatingCash))} ${netOperatingCash < 0 ? 'Outflow' : 'Inflow'}</strong></span></div>
                    
                    <div style="height:20px;"></div>

                    <div class="summary-row total"><span class="summary-label"><strong>CASH FLOWS FROM FINANCING ACTIVITIES</strong></span></div>
                    
                    <div class="summary-row"><span class="summary-label" style="padding-left:24px">Capital Invested / Deposits</span><span class="summary-value" style="color:var(--accent-success)">PKR ${Utils.formatPKR(capitalDeposits)}</span></div>
                    <div class="summary-row"><span class="summary-label" style="padding-left:24px">Capital Withdrawn</span><span class="summary-value" style="color:var(--accent-danger)">( PKR ${Utils.formatPKR(capitalWithdrawals)} )</span></div>
                    
                    <div class="summary-row" style="border-top: 1px solid var(--border-color); margin-top: 8px;"><span class="summary-label"><strong>Net Cash from Financing Activities</strong></span><span class="summary-value" style="color:${netFinancingCash >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}"><strong>PKR ${Utils.formatPKR(Math.abs(netFinancingCash))} ${netFinancingCash < 0 ? 'Outflow' : 'Inflow'}</strong></span></div>
                    
                    <div style="height:20px;"></div>
                    
                    <div class="summary-row total"><span class="summary-label" style="font-size: 1.1rem"><strong>NET INCREASE / (DECREASE) IN CASH</strong></span><span class="summary-value" style="color:${netCashFlow >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}; font-size: 1.2rem"><strong>PKR ${Utils.formatPKR(netCashFlow)}</strong></span></div>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════
    // P&L PDF — Professional Financial Template
    // ═══════════════════════════════════════════════
    async exportPDF() {
        const from = document.getElementById('rp-from').value;
        const to = document.getElementById('rp-to').value;
        if (!from || !to) { Utils.showToast('Generate report first', 'warning'); return; }
        Utils.showLoading('Generating P&L PDF...');

        try {
            const purchases = (await DB.getAll('purchases')).filter(p => p.date >= from && p.date <= to);
            const sales = (await DB.getAll('sales')).filter(s => s.date >= from && s.date <= to);
            const expenses = (await DB.getAll('expenses')).filter(e => e.date >= from && e.date <= to);

            const rev = sales.reduce((s, x) => s + (x.amount || 0), 0);
            const cogs = purchases.reduce((s, p) => s + (p.netPayableAmount || p.amount || 0), 0);
            const exp = expenses.reduce((s, e) => s + (e.amount || 0), 0);
            const gross = rev - cogs;
            const net = gross - exp;

            const expByType = {};
            expenses.forEach(e => { expByType[e.type] = (expByType[e.type] || 0) + e.amount; });

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const biz = await Settings.getBusiness();

            let y = this.drawReportHeader(doc, biz, 'PROFIT & LOSS STATEMENT', from, to);

            // Layout constants
            const labelX = 20;
            const subX = 30;
            const detailX = 35;
            const col1 = 145;
            const col2 = 185;

            // Helper functions
            const sectionHead = (text) => {
                if (y > 265) { doc.addPage(); y = 20; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.text(text, labelX - 5, y);
                y += 6;
            };

            const row = (label, amount, opts = {}) => {
                if (y > 275) { doc.addPage(); y = 20; }
                doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
                doc.setFontSize(opts.size || 9);
                doc.text(label, opts.indent || subX, y);
                const col = opts.col2 ? col2 : col1;
                doc.text(Utils.formatPKR(amount), col, y, { align: 'right' });
                y += opts.spacing || 5.5;
            };

            const subtotalLine = (col) => {
                doc.setLineWidth(0.2);
                const c = col === 2 ? col2 : col1;
                doc.line(c - 35, y - 3, c, y - 3);
            };

            const doubleLine = () => {
                doc.setLineWidth(0.5);
                doc.line(15, y - 2, 195, y - 2);
            };

            // ═══ REVENUE ═══
            sectionHead('REVENUE');
            row('Gross Sales Revenue', rev);
            row('Less: Returns & Discounts', 0);
            subtotalLine(1);
            row('Net Sales Revenue', rev, { col2: true, bold: true });
            y += 2;

            // ═══ COST OF GOODS SOLD ═══
            sectionHead('COST OF GOODS SOLD');
            row('Opening Inventory', 0, { indent: detailX });
            row('Add: Purchases (' + purchases.length + ' receipts)', cogs, { indent: detailX });
            subtotalLine(1);
            row('Goods Available for Sale', cogs);
            row('Less: Closing Inventory', 0);
            subtotalLine(2);
            row('Total Cost of Goods Sold', cogs, { col2: true, bold: true });
            y += 3;

            doubleLine();
            y += 2;

            // Gross Profit
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('GROSS PROFIT', labelX - 5, y);
            doc.text(Utils.formatPKR(gross), col2, y, { align: 'right' });
            const grossMargin = rev > 0 ? ((gross / rev) * 100).toFixed(1) : '0.0';
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text('(' + grossMargin + '% margin)', col2, y + 4, { align: 'right' });
            y += 10;

            // ═══ OPERATING EXPENSES ═══
            sectionHead('OPERATING EXPENSES');
            const expKeys = Object.keys(expByType);
            if (expKeys.length === 0) {
                row('(No expenses recorded)', 0);
            } else {
                for (const t of expKeys) {
                    const name = t.charAt(0).toUpperCase() + t.slice(1);
                    row(name, expByType[t], { indent: detailX });
                }
            }
            subtotalLine(2);
            row('Total Operating Expenses', exp, { col2: true, bold: true });
            y += 3;

            doubleLine();
            y += 2;

            // Operating Income
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('OPERATING INCOME (EBIT)', labelX - 5, y);
            doc.text(Utils.formatPKR(net), col2, y, { align: 'right' });
            y += 8;

            // ═══ OTHER INCOME/EXPENSES ═══
            if (y > 230) { doc.addPage(); y = 20; }
            sectionHead('OTHER INCOME / (EXPENSES)');
            row('Interest Income', 0, { indent: detailX });
            row('Interest Expense', 0, { indent: detailX });
            row('Other Non-Operating Income', 0, { indent: detailX });
            subtotalLine(2);
            row('Total Other Income / (Expenses)', 0, { col2: true, bold: true });
            y += 3;

            doubleLine();
            y += 2;

            // Income Before Tax
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('INCOME BEFORE INCOME TAX', labelX - 5, y);
            doc.text(Utils.formatPKR(net), col2, y, { align: 'right' });
            y += 6;

            row('Less: Income Tax Provision', 0);
            subtotalLine(2);
            y += 2;

            // ═══ NET INCOME ═══
            if (y > 260) { doc.addPage(); y = 20; }
            doc.setLineWidth(0.6);
            doc.rect(15, y - 4, 180, 12, 'S');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('NET INCOME / (LOSS)', 18, y + 3);
            doc.text('PKR ' + Utils.formatPKR(net), col2, y + 3, { align: 'right' });
            const netMargin = rev > 0 ? ((net / rev) * 100).toFixed(1) : '0.0';
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text('Net Margin: ' + netMargin + '%', col2, y + 7, { align: 'right' });

            // Footer
            y += 18;
            if (y > 275) { doc.addPage(); y = 20; }
            doc.setLineWidth(0.3);
            doc.line(15, y, 75, y);
            doc.line(135, y, 195, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text('Prepared By', 45, y + 5, { align: 'center' });
            doc.text('Authorized Signature', 165, y + 5, { align: 'center' });

            y += 12;
            doc.setFontSize(6);
            doc.setTextColor(120);
            doc.text('This statement was auto-generated by AgriSys on ' + new Date().toLocaleString() + '. All amounts in Pakistani Rupees (PKR).', 105, y, { align: 'center' });
            doc.setTextColor(0);

            doc.save(`PnL_${from}_${to}.pdf`);
            Utils.hideLoading();
            Utils.showToast('P&L PDF generated!');
        } catch (err) {
            Utils.hideLoading();
            Utils.showToast('PDF error: ' + err.message, 'error');
        }
    },

    // ═══════════════════════════════════════════════
    // SUMMARY PDF — Comprehensive Business Overview
    // ═══════════════════════════════════════════════
    async exportSummaryPDF() {
        const from = document.getElementById('rp-from').value;
        const to   = document.getElementById('rp-to').value;
        if (!from || !to) { Utils.showToast('Select date range', 'warning'); return; }
        Utils.showLoading('Generating Summary PDF...');

        try {
            const purchases  = (await DB.getAll('purchases')).filter(p => p.date >= from && p.date <= to);
            const sales      = (await DB.getAll('sales')).filter(s => s.date >= from && s.date <= to);
            const expenses   = (await DB.getAll('expenses')).filter(e => e.date >= from && e.date <= to);
            const pPayments  = (await DB.getAll('purchase_payments')).filter(p => p.date >= from && p.date <= to);
            const sPayments  = (await DB.getAll('sale_payments')).filter(p => p.date >= from && p.date <= to);

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const biz = await Settings.getBusiness();

            let y = this.drawReportHeader(doc, biz, 'BUSINESS SUMMARY REPORT', from, to);

            const rev         = sales.reduce((s, x) => s + (x.amount || 0), 0);
            const cogs        = purchases.reduce((s, p) => s + (p.netPayableAmount || p.amount || 0), 0);
            const exp         = expenses.reduce((s, e) => s + (e.amount || 0), 0);
            const grossProfit = rev - cogs;
            const netProfit   = grossProfit - exp;

            // Cash flow
            const totalFarmerPaid = purchases.reduce((s, p) => s + (p.amountPaid || 0), 0);
            const totalBuyerReceived = sales.reduce((s, p) => s + (p.amountReceived || 0), 0);
            const farmerBalance = cogs - totalFarmerPaid;
            const buyerBalance = rev - totalBuyerReceived;

            const expByType = {};
            expenses.forEach(e => { expByType[e.type] = (expByType[e.type] || 0) + e.amount; });

            // ── KEY METRICS TABLE ──
            doc.autoTable({
                startY: y,
                head: [['Key Metrics', 'Value', 'Details']],
                body: [
                    ['Total Purchases', purchases.length + ' receipts', 'PKR ' + Utils.formatPKR(cogs)],
                    ['Total Sales', sales.length + ' receipts', 'PKR ' + Utils.formatPKR(rev)],
                    ['Total Expenses', expenses.length + ' entries', 'PKR ' + Utils.formatPKR(exp)],
                    ['Gross Profit', (rev > 0 ? ((grossProfit/rev)*100).toFixed(1) : '0') + '% margin', 'PKR ' + Utils.formatPKR(grossProfit)],
                    ['Net Profit', (rev > 0 ? ((netProfit/rev)*100).toFixed(1) : '0') + '% margin', 'PKR ' + Utils.formatPKR(netProfit)],
                    ['Payable to Farmers', 'Outstanding balance', 'PKR ' + Utils.formatPKR(farmerBalance)],
                    ['Receivable from Buyers', 'Outstanding balance', 'PKR ' + Utils.formatPKR(buyerBalance)],
                ],
                theme: 'grid',
                headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                styles: { fontSize: 8, font: 'helvetica', textColor: 20, lineColor: 180, lineWidth: 0.15, cellPadding: 3 },
                alternateRowStyles: { fillColor: [248, 248, 248] },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 55 },
                    1: { cellWidth: 50, halign: 'center' },
                    2: { halign: 'right', fontStyle: 'bold', cellWidth: 'auto' }
                }
            });
            y = doc.lastAutoTable.finalY + 10;

            // ── P&L SUMMARY ──
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('PROFIT & LOSS SUMMARY', 15, y);
            y += 5;

            const plData = [
                ['Sales Revenue', '', 'PKR ' + Utils.formatPKR(rev)],
                ['Less: Cost of Goods Sold', '', '(PKR ' + Utils.formatPKR(cogs) + ')'],
                ['Gross Profit', (rev > 0 ? ((grossProfit/rev)*100).toFixed(1) : '0') + '%', 'PKR ' + Utils.formatPKR(grossProfit)]
            ];
            
            // Add expense rows
            Object.entries(expByType).forEach(([t, a]) => {
                plData.push(['  ' + t.charAt(0).toUpperCase() + t.slice(1), '', '(PKR ' + Utils.formatPKR(a) + ')']);
            });
            plData.push(['Total Expenses', '', '(PKR ' + Utils.formatPKR(exp) + ')']);
            plData.push(['NET PROFIT / (LOSS)', (rev > 0 ? ((netProfit/rev)*100).toFixed(1) : '0') + '%', 'PKR ' + Utils.formatPKR(netProfit)]);

            doc.autoTable({
                startY: y,
                body: plData,
                theme: 'plain',
                styles: { fontSize: 9, font: 'helvetica', textColor: 20, cellPadding: 2.5 },
                columnStyles: {
                    0: { cellWidth: 80 },
                    1: { halign: 'center', cellWidth: 30, textColor: 120 },
                    2: { halign: 'right', fontStyle: 'bold' }
                },
                didDrawCell: (data) => {
                    // Bold the last row and Gross Profit
                    if (data.row.index === plData.length - 1 || data.row.index === 2) {
                        doc.setLineWidth(0.3);
                        doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
                    }
                }
            });
            y = doc.lastAutoTable.finalY + 10;

            // ── CROP-WISE TABLE ──
            const crops = [...new Set([...purchases.map(p => p.crop), ...sales.map(s => s.crop)].filter(Boolean))];
            if (crops.length > 0) {
                if (y > 200) { doc.addPage(); y = 20; }

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.text('CROP-WISE ANALYSIS', 15, y);
                y += 5;

                const cropRows = crops.map(c => {
                    const pC = purchases.filter(p => p.crop === c);
                    const sC = sales.filter(s => s.crop === c);
                    const eC = expenses.filter(e => e.crop === c);
                    const bWeight = pC.reduce((s, p) => s + (p.netWeight || 0), 0);
                    const sWeight = sC.reduce((s, p) => s + (p.netWeight || 0), 0);
                    const cRev = sC.reduce((s, x) => s + (x.amount || 0), 0);
                    const cCost = pC.reduce((s, p) => s + (p.netPayableAmount || p.amount || 0), 0);
                    const cExp = eC.reduce((s, e) => s + (e.amount || 0), 0);
                    const profit = cRev - cCost - cExp;
                    return [
                        c,
                        Utils.formatNum(bWeight, 0) + ' KG',
                        'PKR ' + Utils.formatPKR(cCost),
                        Utils.formatNum(sWeight, 0) + ' KG',
                        'PKR ' + Utils.formatPKR(cRev),
                        'PKR ' + Utils.formatPKR(cExp),
                        'PKR ' + Utils.formatPKR(profit)
                    ];
                });

                doc.autoTable({
                    startY: y,
                    head: [['Crop', 'Bought', 'Purchase Cost', 'Sold', 'Revenue', 'Expenses', 'Profit']],
                    body: cropRows,
                    theme: 'grid',
                    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold', fontSize: 7 },
                    styles: { fontSize: 7.5, font: 'helvetica', textColor: 20, lineColor: 180, lineWidth: 0.15, cellPadding: 2 },
                    alternateRowStyles: { fillColor: [248, 248, 248] },
                    columnStyles: {
                        0: { fontStyle: 'bold' },
                        1: { halign: 'right' },
                        2: { halign: 'right' },
                        3: { halign: 'right' },
                        4: { halign: 'right' },
                        5: { halign: 'right' },
                        6: { halign: 'right', fontStyle: 'bold' }
                    }
                });
                y = doc.lastAutoTable.finalY + 10;
            }

            // ── FINAL NET BOX ──
            if (y > 265) { doc.addPage(); y = 20; }
            doc.setLineWidth(0.6);
            doc.rect(15, y - 4, 180, 12, 'S');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('CUMULATIVE NET PROFIT / (LOSS)', 18, y + 3);
            doc.text('PKR ' + Utils.formatPKR(netProfit), 192, y + 3, { align: 'right' });

            // Signatures
            y += 20;
            if (y > 275) { doc.addPage(); y = 20; }
            doc.setLineWidth(0.3);
            doc.line(15, y, 75, y);
            doc.line(135, y, 195, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text('Prepared By', 45, y + 5, { align: 'center' });
            doc.text('Authorized Signature', 165, y + 5, { align: 'center' });

            y += 12;
            doc.setFontSize(6);
            doc.setTextColor(120);
            doc.text('Auto-generated by AgriSys on ' + new Date().toLocaleString() + '. All amounts in PKR.', 105, y, { align: 'center' });
            doc.setTextColor(0);

            doc.save(`Business_Summary_${from}_${to}.pdf`);
            Utils.hideLoading();
            Utils.showToast('Summary PDF generated!');
        } catch (err) {
            Utils.hideLoading();
            Utils.showToast('PDF error: ' + err.message, 'error');
        }
    },

    // ═══════════════════════════════════════════════
    // EXCEL EXPORTS
    // ═══════════════════════════════════════════════
    async exportExcel() {
        const from = document.getElementById('rp-from').value;
        const to = document.getElementById('rp-to').value;
        if (!from || !to) { Utils.showToast('Generate report first', 'warning'); return; }
        
        const purchases = (await DB.getAll('purchases')).filter(p => p.date >= from && p.date <= to);
        const sales = (await DB.getAll('sales')).filter(s => s.date >= from && s.date <= to);
        const expenses = (await DB.getAll('expenses')).filter(e => e.date >= from && e.date <= to);
        const rev = sales.reduce((s, x) => s + (x.amount || 0), 0);
        const cogs = purchases.reduce((s, p) => s + (p.netPayableAmount || p.amount || 0), 0);
        const exp = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        const gross = rev - cogs;

        // Expense breakdown
        const expByType = {};
        expenses.forEach(e => { expByType[e.type] = (expByType[e.type] || 0) + e.amount; });

        const rows = [
            { Section: 'Revenue', Item: 'Gross Sales', Amount: rev },
            { Section: '', Item: 'Net Sales', Amount: rev },
            { Section: 'COGS', Item: 'Purchases', Amount: cogs },
            { Section: '', Item: 'Total COGS', Amount: cogs },
            { Section: '', Item: 'GROSS PROFIT', Amount: gross },
        ];
        Object.entries(expByType).forEach(([t, a]) => {
            rows.push({ Section: 'Expenses', Item: t.charAt(0).toUpperCase() + t.slice(1), Amount: a });
        });
        rows.push({ Section: '', Item: 'Total Expenses', Amount: exp });
        rows.push({ Section: '', Item: 'NET PROFIT / (LOSS)', Amount: gross - exp });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'P&L');
        XLSX.writeFile(wb, `PnL_${from}_${to}.xlsx`);
        Utils.showToast('P&L Excel exported!');
    },

    async exportSummaryExcel() {
        const from = document.getElementById('rp-from').value;
        const to = document.getElementById('rp-to').value;
        if (!from || !to) { Utils.showToast('Select date range', 'warning'); return; }

        const purchases = (await DB.getAll('purchases')).filter(p => p.date >= from && p.date <= to);
        const sales = (await DB.getAll('sales')).filter(s => s.date >= from && s.date <= to);
        const expenses = (await DB.getAll('expenses')).filter(e => e.date >= from && e.date <= to);

        const rev = sales.reduce((s, x) => s + (x.amount || 0), 0);
        const cogs = purchases.reduce((s, p) => s + (p.netPayableAmount || p.amount || 0), 0);
        const exp = expenses.reduce((s, e) => s + (e.amount || 0), 0);

        const overview = [
            { Metric: 'Period', Value: from + ' to ' + to },
            { Metric: 'Total Purchases', Value: purchases.length },
            { Metric: 'Total Purchase Amount (PKR)', Value: cogs },
            { Metric: 'Total Sales', Value: sales.length },
            { Metric: 'Total Sales Amount (PKR)', Value: rev },
            { Metric: 'Total Expenses (PKR)', Value: exp },
            { Metric: 'Gross Profit (PKR)', Value: rev - cogs },
            { Metric: 'Net Profit (PKR)', Value: rev - cogs - exp },
            { Metric: 'Gross Margin (%)', Value: rev > 0 ? ((rev - cogs)/rev*100).toFixed(1) + '%' : '0%' },
            { Metric: 'Net Margin (%)', Value: rev > 0 ? ((rev - cogs - exp)/rev*100).toFixed(1) + '%' : '0%' },
            { Metric: 'Farmer Balance Outstanding (PKR)', Value: cogs - purchases.reduce((s, p) => s + (p.amountPaid || 0), 0) },
            { Metric: 'Buyer Balance Outstanding (PKR)', Value: rev - sales.reduce((s, p) => s + (p.amountReceived || 0), 0) },
        ];

        const crops = [...new Set([...purchases.map(p => p.crop), ...sales.map(s => s.crop)].filter(Boolean))];
        const cropRows = crops.map(c => {
            const pC = purchases.filter(p => p.crop === c);
            const sC = sales.filter(s => s.crop === c);
            const eC = expenses.filter(e => e.crop === c);
            const bWeight = pC.reduce((s, p) => s + (p.netWeight || 0), 0);
            const sWeight = sC.reduce((s, p) => s + (p.netWeight || 0), 0);
            const cRev = sC.reduce((s, x) => s + (x.amount || 0), 0);
            const cCost = pC.reduce((s, p) => s + (p.netPayableAmount || p.amount || 0), 0);
            const cExp = eC.reduce((s, e) => s + (e.amount || 0), 0);
            return {
                'Crop': c,
                'Purchased (KG)': bWeight,
                'Purchased (Maund)': (bWeight / 40).toFixed(2),
                'Purchase Cost (PKR)': cCost,
                'Avg Buy Rate/Mn': bWeight > 0 ? (cCost / (bWeight / 40)).toFixed(2) : 0,
                'Sold (KG)': sWeight,
                'Sold (Maund)': (sWeight / 40).toFixed(2),
                'Revenue (PKR)': cRev,
                'Avg Sell Rate/Mn': sWeight > 0 ? (cRev / (sWeight / 40)).toFixed(2) : 0,
                'Expenses (PKR)': cExp,
                'Profit (PKR)': cRev - cCost - cExp
            };
        });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overview), 'Overview');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cropRows), 'Crop Analysis');
        XLSX.writeFile(wb, `Business_Summary_${from}_${to}.xlsx`);
        Utils.showToast('Summary Excel exported!');
    }
};
