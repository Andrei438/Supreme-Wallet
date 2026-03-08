let allCustomers = [];
let allPayments = []; // Needed to calculate total spend locally if Stripe Customer object doesn't have it direct

document.addEventListener('DOMContentLoaded', async () => {
    await App.ready;
    if (!App.state.user) return;

    if (window.innerWidth < 768) {
        document.getElementById('desktop-sidebar-btn').style.display = 'none';
        document.getElementById('mobile-menu-btn').style.display = 'block';
    }

    App.setupTabs('#customer-modal'); // Standard tab setup for profile modal

    // Event Listeners
    document.getElementById('search-input').addEventListener('input', renderCustomers);

    await loadData();
});

async function loadData() {
    try {
        const [cRes, pRes] = await Promise.all([
            App.apiGet('/api/customers'),
            App.apiGet('/api/payments?limit=100') // Adjust limit if needed
        ]);

        allCustomers = cRes.data;
        allPayments = pRes.data;

        renderCustomers();
    } catch (error) {
        App.showToast('Failed to load customers', 'error');
        document.getElementById('customers-tbody').innerHTML = `
            <tr><td colspan="5" class="empty-state"><i class="ph ph-warning-circle text-muted"></i><p>Error loading data</p></td></tr>
        `;
    }
}

function calculateSpend(customerId) {
    const customerPayments = allPayments.filter(p => p.customer === customerId && p.status === 'succeeded');
    const total = customerPayments.reduce((acc, curr) => acc + curr.amount, 0);
    const currency = customerPayments.length > 0 ? customerPayments[0].currency : 'usd';
    return { total, currency, count: customerPayments.length, payments: customerPayments };
}

function renderCustomers() {
    const tbody = document.getElementById('customers-tbody');
    const query = document.getElementById('search-input').value.toLowerCase();

    const filtered = allCustomers.filter(c => {
        const matchName = c.name && c.name.toLowerCase().includes(query);
        const matchEmail = c.email && c.email.toLowerCase().includes(query);
        const matchId = c.id.toLowerCase().includes(query);
        return matchName || matchEmail || matchId;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="ph ph-users text-muted" style="font-size: 3rem;"></i><p>No customers found</p></td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(c => {
        const spendInfo = calculateSpend(c.id);
        const name = c.name || 'Unnamed Customer';
        const email = c.email || 'No email provided';
        const initial = name.charAt(0).toUpperCase();

        html += `
            <tr style="cursor: pointer;" onclick="openCustomerModal('${c.id}')">
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="avatar avatar-sm">${initial}</div>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: 600;">${name}</span>
                            <span class="text-muted" style="font-size: 0.75rem;"><code class="inline-code" style="background:transparent;border:none;padding:0;">${c.id}</code></span>
                        </div>
                    </div>
                </td>
                <td>${email}</td>
                <td class="td-amount">${App.formatCurrency(spendInfo.total, spendInfo.currency)}</td>
                <td class="text-muted">${App.formatDate(c.created)}</td>
                <td class="text-right">
                    <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openCustomerModal('${c.id}')">View</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function openCustomerModal(id) {
    const c = allCustomers.find(cust => cust.id === id);
    if (!c) return;

    const spendInfo = calculateSpend(c.id);
    const name = c.name || 'Unnamed Customer';

    document.getElementById('modal-avatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('modal-name').textContent = name;
    document.getElementById('modal-email').textContent = c.email || 'No email provided';
    document.getElementById('modal-id').textContent = c.id;
    document.getElementById('modal-spend').textContent = App.formatCurrency(spendInfo.total, spendInfo.currency);
    document.getElementById('modal-created').textContent = App.formatDate(c.created);
    document.getElementById('tab-count-payments').textContent = spendInfo.count;

    // Is Subscriber?
    // Stripe SDK doesn't always return full sub object on customer list. If we had a subscriptions endpoint we could cross ref.
    // For now we assume if they have a non-null `subscriptions` property or default payment method they might be active.
    if (c.subscriptions && c.subscriptions.data && c.subscriptions.data.length > 0) {
        document.getElementById('modal-sub-status').style.display = 'inline-flex';
    } else {
        document.getElementById('modal-sub-status').style.display = 'none';
    }

    // Populate Overview Activity
    const actContainer = document.getElementById('c-overview-activity');
    if (spendInfo.count === 0) {
        actContainer.innerHTML = '<span class="text-muted">No recent activity.</span>';
    } else {
        const lastPay = spendInfo.payments[0]; // Assuming payments are sorted by creation date descending
        actContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 12px; align-items: center;">
                    <i class="ph ph-check-circle text-success" style="font-size: 1.5rem;"></i>
                    <div>
                        <div style="font-weight: 500;">Latest Payment Succeeded</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${App.formatDate(lastPay.created)}</div>
                    </div>
                </div>
                <div style="font-weight: 700;">${App.formatCurrency(lastPay.amount, lastPay.currency)}</div>
            </div>
        `;
    }

    // Populate Payments Tab List
    const payTbody = document.getElementById('c-payments-tbody');
    if (spendInfo.count === 0) {
        payTbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted" style="padding: 24px;">No payments found.</td></tr>`;
    } else {
        let ph = '';
        spendInfo.payments.forEach(p => {
            ph += `
                <tr>
                    <td class="td-amount">${App.formatCurrency(p.amount, p.currency)}</td>
                    <td><span class="badge badge-success">Succeeded</span></td>
                    <td class="text-muted">${App.formatDate(p.created)}</td>
                </tr>
            `;
        });
        payTbody.innerHTML = ph;
    }

    // Populate Metadata Tab
    const metaObj = c.metadata && Object.keys(c.metadata).length > 0 ? c.metadata : { message: 'No metadata attached' };
    document.getElementById('c-meta-json').textContent = JSON.stringify(metaObj, null, 2);

    // Reset Tabs
    document.querySelectorAll('#customer-tabs .tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#customer-tabs-container .tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('#customer-tabs .tab-item[data-target="c-overview"]').classList.add('active');
    document.getElementById('c-overview').classList.add('active');

    App.openModal('customer-modal');
}
