export function renderSettings() {
    const darkOn = localStorage.getItem('fincapp_theme') === 'dark';
    const pending = JSON.parse(localStorage.getItem('fincapp_offline_queue') || '[]').length;

    return `
    <div class="max-w-2xl mx-auto space-y-6">
        <div>
            <h2 class="text-xl font-bold">Settings</h2>
            <p class="text-sm text-[var(--text-secondary)]">Configure FincApp 2.0 — Powered by AURA.</p>
        </div>

        <div class="card">
            <h3 class="text-lg font-bold mb-4">Appearance</h3>
            <label class="flex items-center justify-between gap-4 cursor-pointer">
                <span>
                    <strong class="block text-sm">Dark Mode</strong>
                    <small class="text-[var(--text-secondary)]">Use a darker interface for night work.</small>
                </span>
                <input type="checkbox" id="setting-dark-mode" ${darkOn ? 'checked' : ''}>
            </label>
        </div>

        <div class="card">
            <h3 class="text-lg font-bold mb-4">Offline Sync</h3>
            <p class="text-sm text-[var(--text-secondary)]">${pending} pending record(s) waiting to sync.</p>
        </div>

        <div class="card border-red-200">
            <h3 class="text-lg font-bold mb-4 text-red-600">Local Cache</h3>
            <button id="btn-clear-cache" class="btn-danger">Clear Local Cache</button>
        </div>
    </div>`;
}

export function initSettingsLogic() {
    document.getElementById('setting-dark-mode')?.addEventListener('change', (event) => {
        const enabled = event.target.checked;
        localStorage.setItem('fincapp_theme', enabled ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', enabled);
    });

    document.getElementById('btn-clear-cache')?.addEventListener('click', () => {
        if (!confirm('Clear local FincApp cache from this browser?')) return;
        Object.keys(localStorage)
            .filter(key => key.startsWith('fincapp_'))
            .forEach(key => localStorage.removeItem(key));
        alert('Local cache cleared');
    });
}
