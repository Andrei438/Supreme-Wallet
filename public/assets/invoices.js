let allInvoices = [];

document.addEventListener('DOMContentLoaded', async () => {
    await App.ready;
    if (!App.state.user) return;

    if (window.innerWidth < 768) {
        document.getElementById('desktop-sidebar-btn').style.display = 'none';
        document.getElementById('mobile-menu-btn').style.display = 'block';
    }

    document.getElementById('search-input').addEventListener('input', renderRows);
    document.getElementById('status-filter').addEventListener('change', renderRows);

    await loadData();
});

async function loadData() {
    try {
        const res = await App.apiGet('/api/invoices?limit=100');
        allInvoices = res.data;
        renderRows();
    } catch (e) {
        App.showToast('Failed to load invoices', 'error');
        document.getElementById('invoices-tbody').innerHTML = `
            <tr><td colspan="5" class="empty-state"><i class="ph ph-warning-circle text-muted"></i><p>Error loading data</p></td></tr>
        `;
    }
}

function renderRows() {
    const tbody = document.getElementById('invoices-tbody');
    const query = document.getElementById('search-input').value.toLowerCase();
    const statusFilt = document.getElementById('status-filter').value;

    const filtered = allInvoices.filter(i => {
        const matchStatus = statusFilt ? i.status === statusFilt : true;
        const searchStr = `${i.number || ''} ${i.customer_email || ''} ${i.id}`.toLowerCase();
        const matchQuery = searchStr.includes(query);
        return matchStatus && matchQuery;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="ph ph-receipt text-muted" style="font-size: 3rem;"></i><p>No invoices found</p></td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(i => {
        let statusClass = 'badge-neutral';
        if (i.status === 'paid') statusClass = 'badge-success';
        if (i.status === 'open') statusClass = 'badge-info';
        if (i.status === 'draft') statusClass = 'badge-warning';
        if (i.status === 'void' || i.status === 'uncollectible') statusClass = 'badge-danger';

        const dlLink = i.invoice_pdf ? `<a href="${i.invoice_pdf}" target="_blank" class="btn btn-secondary btn-sm"><i class="ph ph-download-simple"></i> Download</a>` : '<span class="text-muted">N/A</span>';

        html += `
            <tr>
                <td>
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 600;">${i.number || 'Draft'}</span>
                        <code class="inline-code" style="background:transparent;border:none;padding:0;color:var(--text-muted);">${i.id}</code>
                    </div>
                </td>
                <td style="font-weight: 500;">
                    ${i.customer_email || 'No email attached'}
                </td>
                <td class="td-amount ${i.status === 'paid' ? 'text-success' : ''}">${App.formatCurrency(i.amount_due, i.currency)}</td>
                <td><span class="badge ${statusClass}">${i.status}</span></td>
                <td>${dlLink}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}
