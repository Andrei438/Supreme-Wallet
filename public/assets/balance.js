let allPayouts = [];

document.addEventListener('DOMContentLoaded', async () => {
    await App.ready;
    if (!App.state.user) return;

    if (window.innerWidth < 768) {
        document.getElementById('desktop-sidebar-btn').style.display = 'none';
        document.getElementById('mobile-menu-btn').style.display = 'block';
    }

    await loadData();
});

async function loadData() {
    try {
        const [balRes, payRes] = await Promise.all([
            App.apiGet('/api/balance'),
            App.apiGet('/api/payouts?limit=100')
        ]);

        allPayouts = payRes.data;

        const avail = balRes.available[0] || { amount: 0, currency: 'usd' };
        const pend = balRes.pending[0] || { amount: 0, currency: 'usd' };

        document.getElementById('balance-available').textContent = App.formatCurrency(avail.amount, avail.currency);
        document.getElementById('balance-pending').textContent = App.formatCurrency(pend.amount, pend.currency);

        const nextP = allPayouts.find(p => p.status === 'pending' || p.status === 'in_transit');
        document.getElementById('next-payout-date').textContent = nextP ? App.formatDate(nextP.arrival_date) : 'No pending';

        renderRows();
    } catch (e) {
        App.showToast('Failed to load balance', 'error');
        document.getElementById('payouts-tbody').innerHTML = `
            <tr><td colspan="4" class="empty-state"><i class="ph ph-warning-circle text-muted"></i><p>Error loading data</p></td></tr>
        `;
    }
}

function renderRows() {
    const tbody = document.getElementById('payouts-tbody');

    if (allPayouts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state"><i class="ph ph-bank text-muted" style="font-size: 3rem;"></i><p>No payouts found</p></td></tr>`;
        return;
    }

    let html = '';
    allPayouts.forEach(p => {
        let statusClass = 'badge-neutral';
        if (p.status === 'paid') statusClass = 'badge-success';
        if (p.status === 'in_transit') statusClass = 'badge-info';
        if (p.status === 'pending') statusClass = 'badge-warning';
        if (p.status === 'failed' || p.status === 'canceled') statusClass = 'badge-danger';

        let destTitle = 'Bank Account';
        let destSub = p.id;

        if (p.destination) {
            if (p.destination.object === 'bank_account') {
                destTitle = `${p.destination.bank_name} •••• ${p.destination.last4}`;
            } else if (p.destination.object === 'card') {
                destTitle = `${p.destination.brand} •••• ${p.destination.last4}`;
            }
        }

        html += `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="avatar avatar-sm" style="background: var(--bg-surface-hover); color: var(--text-main); border: 1px solid var(--border-color);">
                            <i class="ph ph-bank"></i>
                        </div>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: 500;">${destTitle}</span>
                            <span class="text-muted" style="font-size: 0.75rem;"><code class="inline-code" style="background:transparent;border:none;padding:0;">${p.id}</code></span>
                        </div>
                    </div>
                </td>
                <td class="td-amount ${p.status === 'paid' ? 'text-success' : ''}">${App.formatCurrency(p.amount, p.currency)}</td>
                <td><span class="badge ${statusClass}">${p.status.replace(/_/g, ' ')}</span></td>
                <td class="text-muted">${App.formatDate(p.arrival_date)}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}
