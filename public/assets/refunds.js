let allRefunds = [];

document.addEventListener('DOMContentLoaded', async () => {
    await App.ready;
    if (!App.state.user) return;

    if (window.innerWidth < 768) {
        document.getElementById('desktop-sidebar-btn').style.display = 'none';
        document.getElementById('mobile-menu-btn').style.display = 'block';
    }

    document.getElementById('search-input').addEventListener('input', renderRows);

    await loadData();
});

async function loadData() {
    try {
        const res = await App.apiGet('/api/refunds?limit=100');
        allRefunds = res.data;
        renderRows();
    } catch (e) {
        App.showToast('Failed to load refunds', 'error');
        document.getElementById('refunds-tbody').innerHTML = `
            <tr><td colspan="5" class="empty-state"><i class="ph ph-warning-circle text-muted"></i><p>Error loading data</p></td></tr>
        `;
    }
}

function renderRows() {
    const tbody = document.getElementById('refunds-tbody');
    const query = document.getElementById('search-input').value.toLowerCase();

    const filtered = allRefunds.filter(r => {
        return (r.id && r.id.toLowerCase().includes(query)) ||
            (r.payment_intent && r.payment_intent.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="ph ph-arrow-u-down-left text-muted" style="font-size: 3rem;"></i><p>No refunds found</p></td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(r => {
        let statusClass = 'badge-neutral';
        if (r.status === 'succeeded') statusClass = 'badge-success';
        if (r.status === 'pending') statusClass = 'badge-warning';
        if (r.status === 'failed' || r.status === 'canceled') statusClass = 'badge-danger';

        const reason = r.reason || 'requested_by_customer';

        html += `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="avatar avatar-sm" style="background: var(--bg-surface-hover); color: var(--danger); border: 1px solid var(--border-color);">
                            <i class="ph ph-arrow-u-down-left"></i>
                        </div>
                        <code class="inline-code" style="background:transparent;border:none;padding:0;">${r.id}</code>
                    </div>
                </td>
                <td><code class="inline-code text-muted" style="background:transparent;border:none;padding:0;">${r.payment_intent || r.charge}</code></td>
                <td class="td-amount text-danger">- ${App.formatCurrency(r.amount, r.currency)}</td>
                <td>
                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                        <span class="badge ${statusClass}">${r.status}</span>
                        <span class="text-muted" style="font-size: 0.75rem; margin-top: 4px;">${reason.replace(/_/g, ' ')}</span>
                    </div>
                </td>
                <td class="text-muted">${App.formatDate(r.created)}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}
