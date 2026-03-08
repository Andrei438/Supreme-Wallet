// Global State & Core Logic
// Detect the base path automatically from the URL (e.g. /wallet)
const _pathParts = window.location.pathname.split('/');
const BASE = _pathParts.length > 1 && _pathParts[1] ? '/' + _pathParts[1] : '';

const App = {
    state: {
        user: null,
        theme: localStorage.getItem('theme') || 'light',
        sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true'
    },

    ready: new Promise(resolve => {
        window._resolveAppReady = resolve;
    }),

    init: async () => {
        // Init theme
        App.setTheme(App.state.theme);

        // Init Sidebar state
        App.toggleSidebar(App.state.sidebarCollapsed, false);

        // Exclude specific pages from auth check
        const publicPages = ['/login.html'];
        const isPublicPage = publicPages.some(page => window.location.pathname.endsWith(page)) || window.location.pathname === '/' || window.location.pathname === '';

        if (!isPublicPage) {
            await App.checkSession();
        }

        if (window._resolveAppReady) window._resolveAppReady();

        // Setup common UI listeners
        App.setupUI();
    },

    checkSession: async () => {
        try {
            const res = await fetch(`${BASE}/api/session`);
            const data = await res.json();

            if (data.authenticated) {
                App.state.user = data.user;
                // Render user details in sidebar/topbar if present
                const userNameEl = document.getElementById('user-name-display');
                if (userNameEl) {
                    userNameEl.textContent = data.user || 'Admin';
                }
            } else {
                window.location.href = `${BASE}/login.html`;
            }
        } catch (e) {
            console.error('Session check failed', e);
            window.location.href = `${BASE}/login.html`;
        }
    },

    logout: async () => {
        try {
            await fetch(`${BASE}/api/logout`, { method: 'POST' });
            window.location.href = `${BASE}/login.html`;
        } catch (e) {
            App.showToast('Failed to logout', 'error');
        }
    },

    // UI Helpers

    setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        App.state.theme = theme;

        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.innerHTML = theme === 'dark'
                ? '<i class="ph ph-sun"></i>'
                : '<i class="ph ph-moon"></i>';
        }
    },

    toggleTheme: () => {
        const newTheme = App.state.theme === 'light' ? 'dark' : 'light';
        App.setTheme(newTheme);
    },

    toggleSidebar: (forceState = null, animate = true) => {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        const isCollapsed = forceState !== null ? forceState : !sidebar.classList.contains('collapsed');

        if (isCollapsed) {
            sidebar.classList.add('collapsed');
            localStorage.setItem('sidebarCollapsed', 'true');
        } else {
            sidebar.classList.remove('collapsed');
            localStorage.setItem('sidebarCollapsed', 'false');
        }
    },

    setupUI: () => {
        // Theme Toggle
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', App.toggleTheme);
        }

        // Sidebar Toggle Desktop
        const sidebarToggleBtn = document.getElementById('sidebar-toggle');
        if (sidebarToggleBtn) {
            sidebarToggleBtn.addEventListener('click', () => App.toggleSidebar());
        }

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', App.logout);
        }

        // Mobile Sidebar Toggle
        const mobileToggle = document.getElementById('mobile-menu-btn');
        const sidebar = document.querySelector('.sidebar');
        if (mobileToggle && sidebar) {
            mobileToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }
    },

    // Enhanced Toast with Title and Icons based on type
    showToast: (message, type = 'success', title = null) => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = '';
        let defaultTitle = '';
        if (type === 'success') { icon = '<i class="ph ph-check-circle fill"></i>'; defaultTitle = 'Success'; }
        else if (type === 'error') { icon = '<i class="ph ph-warning-circle fill"></i>'; defaultTitle = 'Error'; }
        else if (type === 'warning') { icon = '<i class="ph ph-warning fill"></i>'; defaultTitle = 'Warning'; }
        else { icon = '<i class="ph ph-info fill"></i>'; defaultTitle = 'Info'; }

        const displayTitle = title || defaultTitle;

        toast.innerHTML = `
            ${icon} 
            <div class="toast-content">
                <span class="toast-title">${displayTitle}</span>
                <span class="toast-message">${message}</span>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('closing');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    formatCurrency: (amount, currency = 'usd') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase()
        }).format(amount / 100);
    },

    formatDate: (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp * 1000);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(date);
    },

    capitalize: (str) => {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // Modal Manager
    openModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            // Prevent body scroll when modal open
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            // Restore body scroll
            document.body.style.overflow = '';
        }
    },

    // Simple Tab Manager Helper
    setupTabs: (tabContainerSelector) => {
        const containers = document.querySelectorAll(tabContainerSelector);
        containers.forEach(container => {
            const tabs = container.querySelectorAll('.tab-item');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetId = tab.getAttribute('data-target');
                    // deactivate all in this container
                    const allTabs = tab.parentElement.querySelectorAll('.tab-item');
                    const allContents = container.querySelectorAll('.tab-content');
                    allTabs.forEach(t => t.classList.remove('active'));
                    allContents.forEach(c => c.classList.remove('active'));

                    // activate target
                    tab.classList.add('active');
                    container.querySelector(`#${targetId}`).classList.add('active');
                });
            });
        });
    },

    apiGet: async (url) => {
        const fullUrl = url.startsWith('/api/') ? `${BASE}${url}` : url;
        try {
            const res = await fetch(fullUrl);
            if (!res.ok) {
                const err = await res.json();
                console.error(`[API Error] GET ${url} failed:`, err);
                throw new Error(err.error || 'Network request failed');
            }
            return await res.json();
        } catch (e) {
            console.error(`[API Network Error] GET ${url} failed:`, e);
            throw e;
        }
    },

    apiPost: async (url, data) => {
        const fullUrl = url.startsWith('/api/') ? `${BASE}${url}` : url;
        const res = await fetch(fullUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Network request failed');
        }
        return await res.json();
    }
};

// Auto-init on load
document.addEventListener('DOMContentLoaded', App.init);
