document.addEventListener('DOMContentLoaded', async () => {
    await App.ready;
    if (!App.state.user) return;

    if (window.innerWidth < 768) {
        document.getElementById('desktop-sidebar-btn').style.display = 'none';
        document.getElementById('mobile-menu-btn').style.display = 'block';
    }

    checkSystemStatus();
});

async function checkSystemStatus() {
    try {
        const res = await App.apiGet('/api/system-status');

        // Stripe
        const sb = document.getElementById('sys-stripe-badge');
        const sv = document.getElementById('sys-stripe-val');
        if (res.stripeConnected) {
            sb.className = 'badge badge-success';
            sb.textContent = 'Connected';
            sv.textContent = 'Active & Authenticated';
        } else {
            sb.className = 'badge badge-danger';
            sb.textContent = 'Error';
            sv.textContent = 'API Key invalid or missing';
        }

        // Webhook
        const wb = document.getElementById('sys-web-badge');
        const wv = document.getElementById('sys-web-val');
        if (res.webhookConfigured) {
            wb.className = 'badge badge-success';
            wb.textContent = 'Configured';
            wv.textContent = 'Endpoint secret provided';
        } else {
            wb.className = 'badge badge-warning';
            wb.textContent = 'Not Setup';
            wv.textContent = 'Missing STRIPE_WEBHOOK_SECRET';
        }

        // Env
        const eb = document.getElementById('sys-env-badge');
        const ev = document.getElementById('sys-env-val');
        eb.className = 'badge badge-info';
        eb.textContent = res.environment.toUpperCase();
        ev.textContent = `Running on Node.js ${res.nodeVersion}`;

    } catch (error) {
        App.showToast('Could not fetch system status', 'error');
    }
}
