document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    // Detect base path from URL (e.g. /wallet)
    const _parts = window.location.pathname.split('/');
    const BASE = _parts.length > 1 && _parts[1] ? '/' + _parts[1] : '';

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const code = document.getElementById('code').value;
        const btn = loginForm.querySelector('button[type="submit"]');

        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Logging in...';
        btn.disabled = true;

        try {
            const res = await fetch(`${BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Login successful - redirect to the dashboard
                window.location.href = `${BASE}/index.html`;
            } else {
                // Show error
                const errorMsg = document.getElementById('login-error');
                errorMsg.textContent = data.error || 'Invalid authenticator code';
                errorMsg.style.display = 'block';
            }
        } catch (error) {
            console.error('Login Error:', error);
            const errorMsg = document.getElementById('login-error');
            errorMsg.textContent = 'Network error occurred. Please try again.';
            errorMsg.style.display = 'block';
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
});
