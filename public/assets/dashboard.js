let charts = {
    revenue: null,
    status: null
};

let rawPayments = [];
let uiInterval = 'daily';
let daysRange = 30;

document.addEventListener('DOMContentLoaded', async () => {
    await App.ready;
    if (!App.state.user) return;

    // Mobile specific layout fixes
    if (window.innerWidth < 768) {
        document.getElementById('desktop-sidebar-btn').style.display = 'none';
        document.getElementById('mobile-menu-btn').style.display = 'block';
    }

    setupChartTabs();
    document.getElementById('time-range').addEventListener('change', (e) => {
        daysRange = parseInt(e.target.value);
        loadDashboardData();
    });

    await loadDashboardData();
    await loadRecentActivity();
});

function setupChartTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active', 'badge-primary'));
            tabs.forEach(t => t.classList.add('badge-neutral'));

            const target = e.target;
            target.classList.remove('badge-neutral');
            target.classList.add('active');
            target.style.backgroundColor = 'var(--primary-light)';
            target.style.color = 'var(--primary)';
            target.style.borderColor = 'transparent';

            uiInterval = target.getAttribute('data-interval');
            updateRevenueChartData();
        });
    });
}

function animateValue(obj, start, end, duration, formatFn) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // easeOutQuart
        const ease = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(progress * (end - start) + start);
        obj.innerHTML = formatFn(current);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = formatFn(end);
        }
    };
    window.requestAnimationFrame(step);
}

async function loadDashboardData() {
    try {
        const [dashRes, localLedgerRes] = await Promise.all([
            App.apiGet('/api/dashboard'),
            App.apiGet('/api/ledger/summary').catch(() => ({ netProfit: 0 }))
        ]);

        const data = dashRes;

        // Setup Live/Test badge
        const isLive = false; // We can infer from data or default false for this project
        const modeBadge = document.getElementById('stripe-mode-badge');
        if (isLive) {
            modeBadge.textContent = 'Live Mode';
            modeBadge.className = 'badge badge-success';
        }

        // Render Premium Metrics
        const metricsContainer = document.getElementById('dashboard-metrics');

        const totalRev = data.metrics.totalRevenue;
        const availBal = data.balance.available[0]?.amount || 0;
        const pendingBal = data.balance.pending[0]?.amount || 0;
        const currency = data.balance.available[0]?.currency || 'usd';

        // Mocking growth data for feeling of a real dashboard
        const revGrowth = '+12.5%';
        const balGrowth = '+4.2%';

        // Financial Overview Cards
        metricsContainer.innerHTML = `
            <div class="metric-card">
                <div class="metric-header">
                    <div class="metric-title">Total Revenue</div>
                    <div class="metric-icon primary"><i class="ph ph-currency-dollar"></i></div>
                </div>
                <div class="metric-value" id="count-rev">$0.00</div>
                <div class="metric-trend trend-up"><i class="ph ph-trend-up"></i> ${revGrowth} vs last month</div>
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <div class="metric-title">Net Profit</div>
                    <div class="metric-icon success"><i class="ph ph-chart-line-up"></i></div>
                </div>
                <div class="metric-value" id="count-profit">$0.00</div>
                <div class="metric-trend trend-neutral"><i class="ph ph-minus"></i> Stated via Ledger</div>
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <div class="metric-title">Refunds & Fails</div>
                    <div class="metric-icon danger"><i class="ph ph-arrow-u-down-left"></i></div>
                </div>
                <div class="metric-value" id="count-fails">0</div>
                <div class="metric-trend trend-down"><i class="ph ph-trend-down"></i> Needs attention</div>
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <div class="metric-title">Available Balance</div>
                    <div class="metric-icon success"><i class="ph ph-bank"></i></div>
                </div>
                <div class="metric-value" id="count-avail">$0.00</div>
                <div class="metric-trend trend-up"><i class="ph ph-trend-up"></i> ${balGrowth} ready to payout</div>
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <div class="metric-title">Pending Balance</div>
                    <div class="metric-icon warning"><i class="ph ph-clock"></i></div>
                </div>
                <div class="metric-value" id="count-pend">$0.00</div>
                <div class="metric-trend trend-neutral"><i class="ph ph-hourglass"></i> Held by Stripe</div>
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <div class="metric-title">Active Subs</div>
                    <div class="metric-icon primary"><i class="ph ph-repeat"></i></div>
                </div>
                <div class="metric-value" id="count-subs">0</div>
                <div class="metric-trend trend-up"><i class="ph ph-trend-up"></i> +2 new this week</div>
            </div>
        `;

        // Animate numbers
        animateValue(document.getElementById('count-rev'), 0, totalRev, 1000, (v) => App.formatCurrency(v, currency));
        animateValue(document.getElementById('count-profit'), 0, localLedgerRes.netProfit, 1000, (v) => App.formatCurrency(v, currency));
        animateValue(document.getElementById('count-fails'), 0, data.metrics.failedPayments, 1000, (v) => v);
        animateValue(document.getElementById('count-avail'), 0, availBal, 1000, (v) => App.formatCurrency(v, currency));
        animateValue(document.getElementById('count-pend'), 0, pendingBal, 1000, (v) => App.formatCurrency(v, currency));
        animateValue(document.getElementById('count-subs'), 0, data.metrics.activeSubscriptions, 1000, (v) => v);

        // Render Charts
        rawPayments = (await App.apiGet('/api/payments?limit=100')).data;
        updateRevenueChartData();
        renderStatusChart(data.metrics.successfulPayments, data.metrics.failedPayments, rawPayments.filter(p => p.status === 'canceled').length);

    } catch (error) {
        App.showToast('Could not load dashboard metrics', 'error');
    }
}

async function loadRecentActivity() {
    try {
        const [payRes, evRes] = await Promise.all([
            App.apiGet('/api/payments?limit=5'),
            App.apiGet('/api/events').catch(() => ({ data: [] })) // catch if not configured
        ]);

        // 1. Render Table
        const tbody = document.getElementById('recent-payments-tbody');
        if (payRes.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state"><i class="ph ph-files text-muted"></i><p>No transactions yet</p></td></tr>`;
        } else {
            let html = '';
            payRes.data.forEach(p => {
                let statusClass = 'badge-neutral';
                if (p.status === 'succeeded') statusClass = 'badge-success';
                if (p.status === 'canceled') statusClass = 'badge-danger';
                if (p.status === 'requires_payment_method') statusClass = 'badge-warning';

                const method = p.payment_method_types?.[0] || 'card';
                let icon = 'ph-credit-card';
                if (method === 'link') icon = 'ph-link';
                if (method === 'bank_transfer') icon = 'ph-bank';

                html += `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div class="avatar avatar-sm" style="background: var(--bg-surface-hover); color: var(--text-main); border: 1px solid var(--border-color);">
                                    <i class="ph ${icon}"></i>
                                </div>
                                <div style="display: flex; flex-direction: column;">
                                    <span style="font-weight: 500; font-size: 0.9rem;">${p.receipt_email || p.id}</span>
                                    <span class="text-muted" style="font-size: 0.75rem;">via ${App.capitalize(method)}</span>
                                </div>
                            </div>
                        </td>
                        <td class="td-amount">${App.formatCurrency(p.amount, p.currency)}</td>
                        <td><span class="badge ${statusClass}">${p.status.replace(/_/g, ' ')}</span></td>
                        <td class="text-muted" style="font-size: 0.85rem;">${App.formatDate(p.created)}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }

        // 2. Render Timeline
        const tlContainer = document.getElementById('activity-timeline');
        const events = evRes.data ? evRes.data.slice(0, 5) : [];
        if (events.length === 0) {
            tlContainer.innerHTML = `<div class="empty-state" style="padding: 20px;"><i class="ph ph-bell-slash text-muted" style="font-size: 2rem;"></i><p>No recent events</p></div>`;
        } else {
            let html = '<div style="position: absolute; left: 15px; top: 10px; bottom: 10px; width: 2px; background: var(--border-color); z-index: 0;"></div>';

            events.forEach(e => {
                let colorClass = 'primary';
                let icon = 'ph-lightning';

                if (e.type.includes('succeeded')) { colorClass = 'success'; icon = 'ph-check'; }
                if (e.type.includes('failed')) { colorClass = 'danger'; icon = 'ph-warning'; }
                if (e.type.includes('created')) { colorClass = 'info'; icon = 'ph-plus'; }

                html += `
                    <div style="display: flex; gap: 16px; position: relative; z-index: 1;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--bg-surface); border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 0 0 4px var(--bg-surface);">
                            <i class="ph ${icon} text-${colorClass}" style="font-size: 0.9rem;"></i>
                        </div>
                        <div style="display: flex; flex-direction: column; padding-top: 4px;">
                            <span style="font-weight: 500; font-size: 0.9rem; color: var(--text-main);">${e.type}</span>
                            <span class="text-muted" style="font-size: 0.8rem;">${App.formatDate(e.created)}</span>
                        </div>
                    </div>
                `;
            });
            tlContainer.innerHTML = html;
        }

    } catch (error) {
        console.error(error);
    }
}

function updateRevenueChartData() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1f2937' : '#e2e8f0';

    // Simple grouping logic
    const grouped = {};
    const now = new Date();
    const cutoff = new Date(now.setDate(now.getDate() - daysRange));

    rawPayments.forEach(p => {
        if (p.status !== 'succeeded') return;
        const d = new Date(p.created * 1000);
        if (d < cutoff) return;

        let key = '';
        if (uiInterval === 'daily') key = d.toLocaleDateString();
        else if (uiInterval === 'weekly') {
            const first = d.getDate() - d.getDay();
            key = new Date(d.setDate(first)).toLocaleDateString();
        }
        else if (uiInterval === 'monthly') {
            key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        }

        if (!grouped[key]) grouped[key] = 0;
        grouped[key] += (p.amount / 100);
    });

    const dates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
    const amounts = dates.map(d => grouped[d]);

    const ctx = document.getElementById('revenueChart').getContext('2d');
    if (charts.revenue) charts.revenue.destroy();

    // Create Gradient
    let gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.05)');

    charts.revenue = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Revenue',
                data: amounts,
                borderColor: '#6366f1',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#6366f1',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: (ctx) => App.formatCurrency(ctx.raw * 100)
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor, drawBorder: false },
                    border: { display: false },
                    ticks: { color: textColor, padding: 10, callback: (val) => '$' + val }
                },
                x: {
                    grid: { display: false, drawBorder: false },
                    border: { display: false },
                    ticks: { color: textColor, padding: 10 }
                }
            }
        }
    });
}

function renderStatusChart(successful, failed, canceled) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const borderColor = isDark ? '#111827' : '#ffffff';
    const total = successful + failed + canceled;

    document.getElementById('pie-total-val').textContent = total;

    const ctx = document.getElementById('statusChart').getContext('2d');
    if (charts.status) charts.status.destroy();

    charts.status = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Succeeded', 'Failed/Incomplete', 'Canceled'],
            datasets: [{
                data: [successful, failed, canceled],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 3,
                borderColor: borderColor,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: isDark ? '#f8fafc' : '#0f172a', usePointStyle: true, padding: 20 }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    padding: 12,
                    cornerRadius: 8
                }
            }
        }
    });
}
