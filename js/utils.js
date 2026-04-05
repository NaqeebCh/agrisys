// ===== AgriSys Utilities =====

const Utils = {
    // Generate unique ID: date-based + random hex
    generateId() {
        const now = new Date();
        const d = String(now.getDate()).padStart(2, '0');
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const y = now.getFullYear();
        const hex = Math.random().toString(16).substring(2, 8).toUpperCase();
        return `${d}${m}${y}-${hex}`;
    },

    // Generate sequential ID with prefix (P-0001, S-0001)
    async generateSequentialId(prefix) {
        const key = `seq_${prefix}`;
        let seq = (await DB.getSetting(key)) || 0;
        seq++;
        await DB.setSetting(key, seq);
        return `${prefix}-${String(seq).padStart(4, '0')}`;
    },

    async getNextReceiptId(type) {
        const key = `seq_${type}`;
        let seq = (await DB.getSetting(key)) || 100000;
        return (seq + 1).toString();
    },

    async confirmReceiptId(type, idUsed) {
        const key = `seq_${type}`;
        let seq = (await DB.getSetting(key)) || 100000;
        if (idUsed === (seq + 1).toString()) {
            await DB.setSetting(key, seq + 1);
        }
    },

    // Generate a random 6-digit number
    generateRandom6DigitId() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    },

    // Format number with Pakistani comma style (1,25,000.00)
    formatPKR(num) {
        if (num === null || num === undefined || isNaN(num)) return '0.00';
        num = parseFloat(num);
        const parts = num.toFixed(2).split('.');
        let intPart = parts[0];
        const decPart = parts[1];
        const isNeg = intPart.startsWith('-');
        if (isNeg) intPart = intPart.substring(1);
        if (intPart.length > 3) {
            const last3 = intPart.slice(-3);
            const rest = intPart.slice(0, -3);
            const pairs = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
            intPart = pairs + ',' + last3;
        }
        return (isNeg ? '-' : '') + intPart + '.' + decPart;
    },

    // Format number with 2 decimal places
    formatNum(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        return parseFloat(num).toFixed(decimals);
    },

    // Format date to local format
    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    formatDateTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },

    // Get today's date in YYYY-MM-DD format for input fields
    todayISO() {
        return new Date().toISOString().split('T')[0];
    },

    // Parse float safely
    pf(val) {
        const n = parseFloat(val);
        return isNaN(n) ? 0 : n;
    },

    // Show toast notification
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4000);
    },

    // Show modal
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
    },

    // Hide modal
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
    },

    // Confirm dialog
    async confirm(message) {
        return new Promise(resolve => {
            const modal = document.getElementById('confirm-modal');
            document.getElementById('confirm-message').textContent = message;
            document.getElementById('confirm-yes').onclick = () => { Utils.hideModal('confirm-modal'); resolve(true); };
            document.getElementById('confirm-no').onclick = () => { Utils.hideModal('confirm-modal'); resolve(false); };
            Utils.showModal('confirm-modal');
        });
    },

    // Debounce
    debounce(fn, delay = 300) {
        let timer;
        return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
    },

    // Status badge HTML
    statusBadge(status) {
        const cls = status === 'paid' ? 'badge-success' : status === 'partial' ? 'badge-warning' : 'badge-danger';
        const label = status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Pending';
        return `<span class="badge ${cls}">${label}</span>`;
    },

    // Urdu digits
    toUrduDigits(num) {
        const urduDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
        return String(num).replace(/\d/g, d => urduDigits[d]);
    },

    // File to Base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // Compress image
    async compressImage(base64, maxWidth = 800, quality = 0.7) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = base64;
        });
    },

    // Highlight search text in string
    highlightText(text, search) {
        if (!search || !text) return text;
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return String(text).replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
    },

    // Date range presets
    getDatePreset(preset) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        switch (preset) {
            case 'this-month':
                return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
            case 'last-month':
                return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
            case 'this-quarter': {
                const q = Math.floor(m / 3) * 3;
                return { from: new Date(y, q, 1), to: new Date(y, q + 3, 0) };
            }
            case 'this-year':
                return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
            case 'last-year':
                return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31) };
            case 'all-time':
                return { from: new Date(2020, 0, 1), to: new Date(y + 1, 11, 31) };
            default:
                return { from: new Date(y, m, 1), to: now };
        }
    },

    // Convert Date to YYYY-MM-DD
    dateToISO(date) {
        return date.toISOString().split('T')[0];
    },

    // Apply date preset to inputs
    applyDatePreset(preset, fromId, toId, callback) {
        const { from, to } = this.getDatePreset(preset);
        document.getElementById(fromId).value = this.dateToISO(from);
        document.getElementById(toId).value = this.dateToISO(to);
        if (callback) callback();
    },

    // Show loading overlay
    showLoading(message = 'Processing...') {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <p class="loading-text">${message}</p>
                </div>`;
            document.body.appendChild(overlay);
        } else {
            overlay.querySelector('.loading-text').textContent = message;
            overlay.style.display = 'flex';
        }
    },

    // Hide loading overlay
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    // Pagination
    paginate(items, page = 1, perPage = 25) {
        const totalPages = Math.max(1, Math.ceil(items.length / perPage));
        page = Math.max(1, Math.min(page, totalPages));
        const start = (page - 1) * perPage;
        return {
            items: items.slice(start, start + perPage),
            page,
            totalPages,
            totalItems: items.length,
            hasNext: page < totalPages,
            hasPrev: page > 1
        };
    },

    // Render pagination controls
    renderPagination(containerId, currentPage, totalPages, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }
        let html = '<div class="pagination">';
        html += `<button class="btn btn-ghost btn-sm" ${currentPage <= 1 ? 'disabled' : ''} onclick="${onPageChange}(${currentPage - 1})">‹ Prev</button>`;
        
        // Page numbers
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
        
        if (startPage > 1) {
            html += `<button class="btn btn-ghost btn-sm" onclick="${onPageChange}(1)">1</button>`;
            if (startPage > 2) html += '<span class="pagination-dots">…</span>';
        }
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="btn ${i === currentPage ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="${onPageChange}(${i})">${i}</button>`;
        }
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += '<span class="pagination-dots">…</span>';
            html += `<button class="btn btn-ghost btn-sm" onclick="${onPageChange}(${totalPages})">${totalPages}</button>`;
        }
        
        html += `<button class="btn btn-ghost btn-sm" ${currentPage >= totalPages ? 'disabled' : ''} onclick="${onPageChange}(${currentPage + 1})">Next ›</button>`;
        html += `<span class="pagination-info">${currentPage} of ${totalPages}</span>`;
        html += '</div>';
        container.innerHTML = html;
    }
};
