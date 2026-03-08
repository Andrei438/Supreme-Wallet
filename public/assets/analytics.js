let charts = {};
let rawData = { payments: [], refunds: [], subs: [], payouts: [], customers: [] };
let daysRange = 30;

document.addEventListener('DOMContentLoaded', async () => {
    await App.ready;
    if (!App.state.user) return;

    if (window.innerWidth < 768) {
        document.getElementById('desktop-sidebar-btn').style.display = 'none';
        document.getElementById('mobile-menu-btn').style.display = 'block';
    }

    setupTimeTabs();
    await loadInitialData();
});

function setupTimeTabs() {
    const tabs = document.querySelectorAll('#time-range-tabs .tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => {
                t.classList.remove('active');
                t.style.background = '';
                t.style.color = '';
            });

            const target = e.target;
            target.classList.add('active');
            target.style.background = 'var(--primary-light)';
            target.style.color = 'var(--primary)';

            const days = target.getAttribute('data-days');
            daysRange = days === 'all' ? 9999 : parseInt(days);
            renderAllAnalytics();
        });
    });
}

async function loadInitialData() {
    try {
        const [payRes, refRes, subRes, payoRes, custRes] = await Promise.all([
            App.apiGet('/api/payments?limit=100'),
            App.apiGet('/api/refunds?limit=100'),
            App.apiGet('/api/subscriptions?limit=100'),
            App.apiGet('/api/payouts?limit=100'),
            App.apiGet('/api/customers?limit=100')
        ]);

        rawData.payments = payRes.data;
        rawData.refunds = refRes.data;
        rawData.subs = subRes.data;
        rawData.payouts = payoRes.data;
        rawData.customers = custRes.data;

        renderAllAnalytics();
    } catch (error) {
        App.showToast('Failed to load analytics data', 'error');
    }
}

function getCutoffDate() {
    const now = new Date();
    return new Date(now.setDate(now.getDate() - daysRange));
}

function groupDataByDate(items, dateField, valField = 'amount') {
    const cutoff = getCutoffDate();
    const grouped = {};

    // Initialize dates in range to 0
    let cursor = new Date(cutoff);
    const end = new Date();
    // if daysRange is huge, just bound to 100 days back for blank initialization
    if (daysRange > 365) cursor = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);

    while (cursor <= end) {
        grouped[cursor.toLocaleDateString()] = 0;
        cursor.setDate(cursor.getDate() + 1);
    }

    items.forEach(item => {
        const d = new Date(item[dateField] * 1000);
        if (d < cutoff && daysRange !== 9999) return;
        const key = d.toLocaleDateString();
        const v = valField === 'count' ? 1 : (item[valField] / 100);
        if (grouped[key] !== undefined) {
            grouped[key] += v;
        } else {
            grouped[key] = v;
        }
    });

    // For large ranges, drop empty left tail to not blow up chart
    const dates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
    let firstNonZero = dates.findIndex(d => grouped[d] > 0);
    if (firstNonZero === -1) firstNonZero = 0;

    // Only trim empty tail if it's super long
    const subset = dates.slice(Math.max(0, firstNonZero - 2));
    return {
        labels: subset,
        data: subset.map(d => grouped[d])
    };
}

function getChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        textColor: isDark ? '#94a3b8' : '#64748b',
        gridColor: isDark ? '#1f2937' : '#e2e8f0',
    };
}

function renderAllAnalytics() {
    renderRevenueTrend();
    renderRefundTrend();
    renderSuccessRate();
    renderSubGrowth();
    renderPayouts();
    renderTopCustomers();
}

function createLineChart(canvasId, chartKey, label, color, dataObj, isCurrency = true) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (charts[chartKey]) charts[chartKey].destroy();

    const colors = getChartColors();

    let gradient = ctx.createLinearGradient(0, 0, 0, 250);
    // Parse hex to rgba
    let r = 0, g = 0, b = 0;
    if (color.length === 7) { r = parseInt(color.slice(1, 3), 16); g = parseInt(color.slice(3, 5), 16); b = parseInt(color.slice(5, 7), 16); }
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.01)`);

    charts[chartKey] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dataObj.labels,
            datasets: [{
                label: label,
                data: dataObj.data,
                borderColor: color,
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index', intersect: false,
                    callbacks: { label: (ctx) => isCurrency ? App.formatCurrency(ctx.raw * 100) : ctx.raw }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: colors.gridColor, drawBorder: false },
                    border: { display: false },
                    ticks: { color: colors.textColor, padding: 8, callback: (v) => isCurrency ? '$' + v : v }
                },
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { color: colors.textColor, maxTicksLimit: 7 }
                }
            }
        }
    });
}

function renderRevenueTrend() {
    const success = rawData.payments.filter(p => p.status === 'succeeded');
    const group = groupDataByDate(success, 'created', 'amount');
    createLineChart('chart-revenue', 'revenue', 'Revenue', '#6366f1', group, true);
}

function renderRefundTrend() {
    const group = groupDataByDate(rawData.refunds, 'created', 'amount');
    createLineChart('chart-refunds', 'refunds', 'Refunded Amount', '#ef4444', group, true);
}

function renderSubGrowth() {
    // Treat creation date of sub as +1
    const group = groupDataByDate(rawData.subs, 'created', 'count');

    // Convert to cumulative if we wanted to true growth, but let's just show new subs per day for simplicity
    createLineChart('chart-subs', 'subs', 'New Subscriptions', '#10b981', group, false);
}

function renderPayouts() {
    // Show total payouts sent
    const success = rawData.payouts.filter(p => p.status === 'paid' || p.status === 'in_transit');
    const group = groupDataByDate(success, 'created', 'amount');

    // Bar chart for payouts makes more sense
    const ctx = document.getElementById('chart-payouts').getContext('2d');
    if (charts.payouts) charts.payouts.destroy();

    const colors = getChartColors();

    charts.payouts = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: group.labels,
            datasets: [{
                label: 'Payouts',
                data: group.data,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor, callback: v => '$' + v } },
                x: { grid: { display: false }, ticks: { color: colors.textColor, maxTicksLimit: 14 } }
            }
        }
    });
}

function renderSuccessRate() {
    const cutoff = getCutoffDate();
    let s = 0, f = 0, c = 0;

    rawData.payments.forEach(p => {
        if (new Date(p.created * 1000) < cutoff && daysRange !== 9999) return;
        if (p.status === 'succeeded') s++;
        else if (p.status === 'canceled' || p.status === 'requires_payment_method') f++;
        else c++; // processing etc
    });

    const ctx = document.getElementById('chart-success').getContext('2d');
    if (charts.success) charts.success.destroy();

    const colors = getChartColors();

    charts.success = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Success', 'Failed/Canceled', 'Other'],
            datasets: [{
                data: [s, f, c],
                backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '70%',
            plugins: {
                legend: { position: 'right', labels: { color: colors.textColor, usePointStyle: true, padding: 16 } }
            }
        }
    });
}

function renderTopCustomers() {
    // Calculate total spend per customer within range (or all-time, usually LTV is all time)
    // To be strictly correct to the selector, let's do all-time for simplicity of LTV, or bounded. Bound it since it's analytics.
    const cutoff = getCutoffDate();
    const spendMap = {};
    const txMap = {};

    rawData.payments.forEach(p => {
        if (p.status !== 'succeeded') return;
        if (new Date(p.created * 1000) < cutoff && daysRange !== 9999) return;

        let cName = p.receipt_email || p.shipping?.name || 'Guest';
        if (!spendMap[cName]) { spendMap[cName] = 0; txMap[cName] = 0; }
        spendMap[cName] += p.amount;
        txMap[cName]++;
    });

    const arr = Object.keys(spendMap).map(k => ({ name: k, total: spendMap[k], txs: txMap[k] }));
    arr.sort((a, b) => b.total - a.total);
    const top = arr.slice(0, 5);

    const tbody = document.getElementById('top-customers-tbody');
    if (top.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="padding: 20px;"><p>No customer data found for this period.</p></td></tr>`;
        return;
    }

    let h = '';
    top.forEach((c, i) => {
        let badge = '';
        if (i === 0) badge = '🏆';
        if (i === 1) badge = '🥈';
        if (i === 2) badge = '🥉';

        h += `
            <tr>
                <td style="font-weight: 600; color: var(--text-muted);">${i + 1} ${badge}</td>
                <td style="font-weight: 500;">${c.name}</td>
                <td class="text-success" style="font-weight: 600;">${App.formatCurrency(c.total, 'usd')}</td>
                <td><span class="badge badge-neutral">${c.txs} purchases</span></td>
            </tr>
        `;
    });
    tbody.innerHTML = h;
}
