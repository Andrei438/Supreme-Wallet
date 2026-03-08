// Use existing logic, just modify table template strings slightly
let allSubs = [];
let metricData = { active: 0, canceled: 0, trialing: 0, mrr: 0 };

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
        const res = await App.apiGet('/api/subscriptions?limit=100');
        allSubs = res.data;

        // Calculate simple metrics
        allSubs.forEach(sub => {
            if (sub.status === 'active') {
                metricData.active++;
                // rough MRR est
                if (sub.items && sub.items.data.length > 0) {
                    const price = sub.items.data[0].price;
                    if (price && price.recurring && price.recurring.interval === 'month') {
                        metricData.mrr += price.unit_amount;
                    } else if (price && price.recurring && price.recurring.interval === 'year') {
                        metricData.mrr += Math.round(price.unit_amount / 12);
                    }
                }
            } else if (sub.status === 'canceled') {
                metricData.canceled++;
            } else if (sub.status === 'trialing') {
                metricData.trialing++;
            }
        });

        document.getElementById('sub-mrr').textContent = App.formatCurrency(metricData.mrr, 'usd');
        document.getElementById('sub-active').textContent = metricData.active;
        document.getElementById('sub-canceled').textContent = metricData.canceled;

        renderRows();
    } catch (e) {
        App.showToast('Failed to load subscriptions', 'error');
        document.getElementById('subscriptions-tbody').innerHTML = `
            <tr><td colspan="4" class="empty-state"><i class="ph ph-warning-circle text-muted"></i><p>Error loading data</p></td></tr>
        `;
    }
}

function renderRows() {
    const tbody = document.getElementById('subscriptions-tbody');
    const query = document.getElementById('search-input').value.toLowerCase();

    const filtered = allSubs.filter(s => {
        return (s.id && s.id.toLowerCase().includes(query)) ||
            (typeof s.customer === 'string' && s.customer.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state"><i class="ph ph-repeat text-muted" style="font-size: 3rem;"></i><p>No subscriptions found</p></td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(s => {
        let statusClass = 'badge-neutral';
        if (s.status === 'active') statusClass = 'badge-success';
        else if (s.status === 'canceled') statusClass = 'badge-danger';
        else if (s.status === 'past_due' || s.status === 'unpaid') statusClass = 'badge-warning';
        else if (s.status === 'trialing') statusClass = 'badge-info';

        let priceStr = 'Unknown';
        if (s.items && s.items.data.length > 0) {
            const price = s.items.data[0].price;
            if (price) {
                priceStr = `${App.formatCurrency(price.unit_amount, price.currency)} / ${price.recurring.interval}`;
            }
        }

        html += `
            <tr>
                <td>
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 500;">${typeof s.customer === 'string' ? `<span class="text-muted" style="font-size: 0.8rem;">cus_</span>${s.customer.split('_')[1]}` : 'Unknown'}</span>
                        <code class="inline-code" style="background:transparent;border:none;padding:0;color:var(--text-muted);">${s.id}</code>
                    </div>
                </td>
                <td><span class="badge ${statusClass}"><i class="ph ph-record"></i> ${s.status}</span></td>
                <td style="font-weight: 500;">${priceStr}</td>
                <td class="text-muted"><i class="ph ph-calendar-blank"></i> ${App.formatDate(s.current_period_end)}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}
