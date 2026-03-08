document.addEventListener('DOMContentLoaded', async () => {
    await App.ready;
    if (!App.state.user) return;

    if (window.innerWidth < 768) {
        document.getElementById('desktop-sidebar-btn').style.display = 'none';
        document.getElementById('mobile-menu-btn').style.display = 'block';
    }

    document.getElementById('ledger-form').addEventListener('submit', addEntry);

    await loadData();
});

async function loadData() {
    try {
        const [sumRes, entRes] = await Promise.all([
            App.apiGet('/api/ledger/summary'),
            App.apiGet('/api/ledger')
        ]);

        document.getElementById('ledger-inc').textContent = App.formatCurrency(sumRes.totalIncome);
        document.getElementById('ledger-exp').textContent = App.formatCurrency(sumRes.totalExpense);
        document.getElementById('ledger-net').textContent = App.formatCurrency(sumRes.netProfit);

        renderRows(entRes.data);
    } catch (e) {
        App.showToast('Failed to load ledger', 'error');
    }
}

function renderRows(entries) {
    const tbody = document.getElementById('ledger-tbody');

    if (entries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="ph ph-book-open text-muted" style="font-size: 3rem;"></i><p>No offline entries</p></td></tr>`;
        return;
    }

    let html = '';
    entries.forEach(e => {
        const isExp = e.type === 'expense';
        const color = isExp ? 'danger' : 'success';
        const sign = isExp ? '-' : '+';
        const icon = isExp ? 'ph-arrow-down-right' : 'ph-arrow-up-right';

        html += `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="avatar avatar-sm" style="background: var(--bg-surface-hover); color: var(--${color}); border: 1px solid var(--border-color);">
                            <i class="ph ${icon}"></i>
                        </div>
                        <span style="font-weight: 500;">${e.notes || e.description || 'No description'}</span>
                    </div>
                </td>
                <td><span class="badge ${isExp ? 'badge-danger' : 'badge-success'}" style="text-transform: capitalize;">${e.type}</span></td>
                <td class="text-${color}" style="font-weight: 600;">${sign} ${App.formatCurrency(e.amount)}</td>
                <td class="text-muted">${new Date(e.date).toLocaleDateString()} ${new Date(e.date).toLocaleTimeString()}</td>
                <td class="text-right">
                    <button class="btn-icon text-danger" title="Delete" onclick="deleteEntry('${e.id}')"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

async function addEntry(e) {
    e.preventDefault();
    const btn = document.getElementById('l-submit');
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
    btn.disabled = true;

    try {
        const payload = {
            type: document.getElementById('l-type').value,
            amount: Math.round(parseFloat(document.getElementById('l-amount').value) * 100),
            notes: document.getElementById('l-desc').value
        };

        await App.apiPost('/api/ledger/add', payload);
        App.showToast('Entry added');
        App.closeModal('ledger-modal');
        document.getElementById('ledger-form').reset();
        await loadData();
    } catch (error) {
        App.showToast(error.message, 'error');
    } finally {
        btn.innerHTML = 'Save Entry';
        btn.disabled = false;
    }
}

async function deleteEntry(id) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
        await App.apiPost('/api/ledger/delete', { id });
        App.showToast('Entry deleted');
        await loadData();
    } catch (error) {
        App.showToast(error.message, 'error');
    }
}
