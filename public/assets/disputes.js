let allDisputes = [];

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
        const res = await App.apiGet('/api/disputes?limit=100');
        allDisputes = res.data;
        renderRows();
    } catch (e) {
        App.showToast('Failed to load disputes', 'error');
        document.getElementById('disputes-tbody').innerHTML = `
            <tr><td colspan="5" class="empty-state"><i class="ph ph-warning-circle text-muted"></i><p>Error loading data</p></td></tr>
        `;
    }
}

function renderRows() {
    const tbody = document.getElementById('disputes-tbody');
    const query = document.getElementById('search-input').value.toLowerCase();

    const filtered = allDisputes.filter(d => {
        return (d.id && d.id.toLowerCase().includes(query)) ||
            (d.charge && d.charge.toLowerCase().includes(query)) ||
            (d.payment_intent && d.payment_intent.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="ph ph-shield-check text-muted" style="font-size: 3rem;"></i><p>No disputes found. You are safe!</p></td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(d => {
        let statusClass = 'badge-neutral';
        if (d.status === 'won') statusClass = 'badge-success';
        if (d.status === 'lost') statusClass = 'badge-danger';
        if (d.status === 'needs_response' || d.status === 'under_review') statusClass = 'badge-warning';

        html += `
            <tr>
                <td>
                    <div style="display: flex; flex-direction: column;">
                        <code class="inline-code" style="background:transparent;border:none;padding:0;">${d.id}</code>
                        <span class="text-muted" style="font-size: 0.75rem;"><i class="ph ph-link"></i> ${d.charge || d.payment_intent}</span>
                    </div>
                </td>
                <td style="font-weight: 500; text-transform: capitalize;">${d.reason.replace(/_/g, ' ')}</td>
                <td class="td-amount text-danger">${App.formatCurrency(d.amount, d.currency)}</td>
                <td><span class="badge ${statusClass}">${d.status.replace(/_/g, ' ')}</span></td>
                <td class="text-muted">${App.formatDate(d.created)}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}
