let allTransactions = [];
let currentTx = null;

document.addEventListener('DOMContentLoaded', async () => {
    await App.ready;
    if (!App.state.user) return;

    if (window.innerWidth < 768) {
        document.getElementById('desktop-sidebar-btn').style.display = 'none';
        document.getElementById('mobile-menu-btn').style.display = 'block';
    }

    App.setupTabs('#tx-tabs-container'); // This assumes the container encompasses tabs and content, but let's adjust to target the wrapper.
    // Manual tab setup since our DOM structure separates tabs from contents slightly differently than the simple helper expects:
    const tabs = document.querySelectorAll('#tx-tabs .tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('#tx-tabs-container .tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-target')).classList.add('active');
        });
    });

    // Event Listeners
    document.getElementById('search-input').addEventListener('input', renderTransactions);
    
    // Status Tabs Filter
    const statusTabs = document.querySelectorAll('#status-tabs .tab-item');
    statusTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            statusTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderTransactions();
        });
    });

    document.getElementById('export-btn').addEventListener('click', exportCSV);

    document.getElementById('confirm-refund-btn').addEventListener('click', processRefund);
    document.getElementById('copy-id-btn').addEventListener('click', copyTxId);

    await loadTransactions();
});

async function loadTransactions() {
    try {
        const res = await App.apiGet('/api/payments?limit=100');
        allTransactions = res.data;
        renderTransactions();
    } catch (error) {
        App.showToast('Failed to load transactions', 'error');
        document.getElementById('transactions-tbody').innerHTML = `
            <tr><td colspan="5" class="empty-state"><i class="ph ph-warning-circle text-muted"></i><p>Error loading data</p></td></tr>
        `;
    }
}

function renderTransactions() {
    const tbody = document.getElementById('transactions-tbody');
    const query = document.getElementById('search-input').value.toLowerCase();
    
    const activeTab = document.querySelector('#status-tabs .tab-item.active');
    const statusFilter = activeTab ? activeTab.getAttribute('data-status') : '';

    const filtered = allTransactions.filter(p => {
        const matchStatus = statusFilter ? p.status === statusFilter : true;

        let metaStr = '';
        if (typeof p.metadata === 'object' && p.metadata !== null) {
            metaStr = Object.values(p.metadata).join(' ').toLowerCase();
        }

        const matchQuery =
            (p.id && p.id.toLowerCase().includes(query)) ||
            (p.receipt_email && p.receipt_email.toLowerCase().includes(query)) ||
            (p.shipping?.name && p.shipping.name.toLowerCase().includes(query)) ||
            (p.description && p.description.toLowerCase().includes(query)) ||
            metaStr.includes(query) ||
            (p.payment_method_types && p.payment_method_types.join(' ').toLowerCase().includes(query));

        return matchStatus && matchQuery;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="ph ph-magnifying-glass text-muted"></i><p>No transactions found</p></td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(p => {
        let statusClass = 'badge-neutral';
        if (p.status === 'succeeded') statusClass = 'badge-success';
        if (p.status === 'canceled') statusClass = 'badge-danger';
        if (p.status === 'requires_payment_method') statusClass = 'badge-warning';

        const method = p.payment_method_types?.[0] || 'card';
        let icon = 'ph-credit-card';
        if (method === 'link') icon = 'ph-link';
        if (method === 'bank_transfer') icon = 'ph-bank';

        const emailOrName = p.receipt_email || p.shipping?.name || 'Guest / Unknown';
        const customerName = p.forum_name || emailOrName;
        const avatarHtml = p.avatar_url ? `<img src="${p.avatar_url}" class="avatar-img">` : App.getAvatarPlaceholder(customerName);

        // Render Row
        html += `
            <tr style="cursor: pointer;" onclick="openDetailsModal('${p.id}')">
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="avatar avatar-sm">
                            ${avatarHtml}
                        </div>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: 500;">${customerName}</span>
                            <span class="text-muted" style="font-size: 0.75rem;">${App.capitalize(method)} • <code class="inline-code" style="background:transparent;border:none;padding:0;">${p.id.slice(0, 8)}...</code></span>
                        </div>
                    </div>
                </td>
                <td class="td-amount">${App.formatCurrency(p.amount, p.currency)}</td>
                <td><span class="badge ${statusClass}">${p.status.replace(/_/g, ' ')}</span></td>
                <td class="text-muted">${App.formatDate(p.created)}</td>
                <td class="text-right">
                    <div style="display: flex; gap: 8px; justify-content: flex-end;" onclick="event.stopPropagation()">
                        <button class="btn-icon" title="View Details" onclick="openDetailsModal('${p.id}')"><i class="ph ph-eye"></i></button>
                        ${p.status === 'succeeded' ?
                `<button class="btn-icon text-danger" title="Refund" onclick="openRefundModal('${p.id}', ${p.amount}, '${p.currency}')"><i class="ph ph-arrow-u-down-left"></i></button>`
                : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function openDetailsModal(id) {
    const tx = allTransactions.find(t => t.id === id);
    if (!tx) return;
    currentTx = tx;

    // Set Overview data
    document.getElementById('detail-amount').textContent = App.formatCurrency(tx.amount, tx.currency);

    let statusClass = 'badge-neutral';
    if (tx.status === 'succeeded') statusClass = 'badge-success';
    if (tx.status === 'canceled') statusClass = 'badge-danger';
    if (tx.status === 'requires_payment_method') statusClass = 'badge-warning';
    document.getElementById('detail-status').innerHTML = `<span class="badge ${statusClass}">${tx.status.replace(/_/g, ' ')}</span>`;

    const emailOrName = tx.receipt_email || tx.shipping?.name || 'Guest User';
    document.getElementById('detail-customer').textContent = emailOrName;
    document.getElementById('detail-email').textContent = tx.customer ? `Customer ID: ${tx.customer}` : 'No attached customer profile';

    document.getElementById('detail-id').textContent = tx.id;
    document.getElementById('detail-date').textContent = App.formatDate(tx.created);

    const method = tx.payment_method_types?.[0] || 'card';
    let icon = 'ph-credit-card';
    if (method === 'link') icon = 'ph-link';
    if (method === 'bank_transfer') icon = 'ph-bank';
    const cardLast4 = tx.payment_method_details?.card?.last4 ? `•••• ${tx.payment_method_details.card.last4}` : '';
    document.getElementById('detail-method').innerHTML = `<i class="ph ${icon}"></i> ${App.capitalize(method)} ${cardLast4}`;

    const metaObj = tx.metadata && Object.keys(tx.metadata).length > 0 ? tx.metadata : { message: 'No metadata attached' };
    document.getElementById('detail-meta').textContent = JSON.stringify(metaObj, null, 2);

    // Setup Refund button in modal
    const rb = document.getElementById('modal-refund-btn');
    if (tx.status === 'succeeded') {
        rb.style.display = 'inline-flex';
        rb.onclick = () => { App.closeModal('details-modal'); openRefundModal(tx.id, tx.amount, tx.currency); };
    } else {
        rb.style.display = 'none';
    }

    // Set Fees Data
    const gross = tx.amount / 100;
    const estFee = (gross * 0.029) + 0.30;
    const net = gross - estFee;

    document.getElementById('fee-gross').textContent = App.formatCurrency(tx.amount, tx.currency);
    document.getElementById('fee-est').textContent = '- ' + App.formatCurrency(estFee * 100, tx.currency);
    document.getElementById('fee-net').textContent = App.formatCurrency(net * 100, tx.currency);

    // Set JSON viewer
    document.getElementById('json-viewer').textContent = JSON.stringify(tx, null, 2);

    // Reset tabs
    document.querySelectorAll('#tx-tabs .tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#tx-tabs-container .tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('#tx-tabs .tab-item[data-target="tx-overview"]').classList.add('active');
    document.getElementById('tx-overview').classList.add('active');

    App.openModal('details-modal');
}

function copyTxId() {
    if (currentTx) {
        navigator.clipboard.writeText(currentTx.id);
        App.showToast('Copied to clipboard', 'info');
    }
}

function openRefundModal(id, amount, currency) {
    document.getElementById('refund-pi-id').value = id;
    document.getElementById('refund-amount-display').textContent = App.formatCurrency(amount, currency);
    App.openModal('refund-modal');
}

async function processRefund() {
    const id = document.getElementById('refund-pi-id').value;
    const btn = document.getElementById('confirm-refund-btn');

    btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Processing...`;
    btn.disabled = true;

    try {
        await App.apiPost('/api/refunds', { payment_intent: id });
        App.showToast('Refund successful!');
        App.closeModal('refund-modal');
        await loadTransactions();
    } catch (error) {
        App.showToast(error.message, 'error');
    } finally {
        btn.innerHTML = 'Confirm Refund';
        btn.disabled = false;
    }
}

function exportCSV() {
    // Only export currently filtered items
    const query = document.getElementById('search-input').value.toLowerCase();
    const activeTab = document.querySelector('#status-tabs .tab-item.active');
    const statusFilter = activeTab ? activeTab.getAttribute('data-status') : '';
    const filtered = allTransactions.filter(p => {
        const matchStatus = statusFilter ? p.status === statusFilter : true;
        let metaStr = '';
        if (typeof p.metadata === 'object' && p.metadata !== null) metaStr = Object.values(p.metadata).join(' ').toLowerCase();
        const matchQuery = (p.id && p.id.toLowerCase().includes(query)) || (p.receipt_email && p.receipt_email.toLowerCase().includes(query)) || metaStr.includes(query) || (p.payment_method_types && p.payment_method_types.join(' ').toLowerCase().includes(query));
        return matchStatus && matchQuery;
    });

    if (filtered.length === 0) {
        App.showToast('No data to export', 'warning');
        return;
    }

    const headers = ['ID', 'CustomerEmail', 'Amount', 'Currency', 'Status', 'Date', 'Method'];
    const rows = filtered.map(p => [
        p.id,
        p.receipt_email || '',
        p.amount / 100,
        p.currency,
        p.status,
        new Date(p.created * 1000).toISOString(),
        p.payment_method_types?.[0] || ''
    ]);

    let csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `supreme_wallet_tx_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
