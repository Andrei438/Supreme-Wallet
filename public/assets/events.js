let allEvents = [];

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
        const res = await App.apiGet('/api/events');
        allEvents = res.data;
        renderRows();
    } catch (e) {
        document.getElementById('events-tbody').innerHTML = `
            <tr><td colspan="3" class="empty-state">
                <i class="ph ph-warning-circle text-muted" style="font-size: 3rem;"></i>
                <p>Not configured. Ensure you have the webhook endpoint established.</p>
            </td></tr>
        `;
    }
}

function renderRows() {
    const tbody = document.getElementById('events-tbody');
    const query = document.getElementById('search-input').value.toLowerCase();

    const filtered = allEvents.filter(e => {
        return (e.type && e.type.toLowerCase().includes(query)) ||
            (e.id && e.id.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-state"><i class="ph ph-bell-slash text-muted" style="font-size: 3rem;"></i><p>No events found</p></td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(e => {
        let colorClass = 'primary';
        let icon = 'ph-lightning';

        if (e.type.includes('succeeded')) { colorClass = 'success'; icon = 'ph-check'; }
        if (e.type.includes('failed')) { colorClass = 'danger'; icon = 'ph-warning'; }
        if (e.type.includes('created')) { colorClass = 'info'; icon = 'ph-plus'; }
        if (e.type.includes('deleted') || e.type.includes('canceled')) { colorClass = 'danger'; icon = 'ph-x'; }
        if (e.type.includes('updated')) { colorClass = 'warning'; icon = 'ph-pencil-simple'; }

        html += `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="avatar avatar-sm" style="background: var(--bg-surface-hover); color: var(--${colorClass}); border: 1px solid var(--border-color);">
                            <i class="ph ${icon}"></i>
                        </div>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: 500;">${e.type}</span>
                            <span class="text-muted" style="font-size: 0.75rem;"><code class="inline-code" style="background:transparent;border:none;padding:0;">${e.id}</code></span>
                        </div>
                    </div>
                </td>
                <td><code class="inline-code text-muted">${e.api_version || 'N/A'}</code></td>
                <td class="text-muted">${App.formatDate(e.created)}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}
