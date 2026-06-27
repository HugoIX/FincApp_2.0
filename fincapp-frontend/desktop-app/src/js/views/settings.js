/**
 * views/settings.js - FincApp 2.0 Settings View
 * Handles visual preferences, AURA voice responses, and offline sync status.
 */

import { showToast } from '../ui-utils.js';
import { setTTS, getTTSStatus } from '../voice-logic.js';
import { getPendingCount, startOfflineSync } from '../api.js';

export function renderSettings() {
    const ttsOn = getTTSStatus();
    const darkOn = localStorage.getItem('fincapp_theme') === 'dark';
    const pendingCount = getPendingCount();

    return `
    <div class="max-w-2xl mx-auto space-y-6">

        <div>
            <h2 class="text-xl font-bold">Settings</h2>
            <p class="text-sm text-[var(--text-secondary)]">
                Configure FincApp 2.0 — Powered by AURA.
            </p>
        </div>

        <div class="card">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                <i class="fas fa-palette text-[var(--accent)]"></i>
                Appearance
            </h3>

            <div class="flex items-center justify-between py-3">
                <div>
                    <p class="font-semibold text-sm">Dark Mode</p>
                    <p class="text-xs text-[var(--text-secondary)]">
                        Use a darker interface for night work.
                    </p>
                </div>

                <label class="toggle-switch">
                    <input type="checkbox" id="setting-dark-mode" ${darkOn ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
        </div>

        <div class="card">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                <i class="fas fa-microphone text-[var(--accent)]"></i>
                AURA Voice Assistant
            </h3>

            <div class="flex items-center justify-between py-3">
                <div>
                    <p class="font-semibold text-sm">Voice Responses</p>
                    <p class="text-xs text-[var(--text-secondary)]">
                        Enable or disable spoken responses from AURA.
                    </p>
                </div>

                <label class="toggle-switch">
                    <input type="checkbox" id="setting-tts" ${ttsOn ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
        </div>

        <div class="card">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                <i class="fas fa-wifi text-[var(--accent)]"></i>
                Offline Synchronization
            </h3>

            <div class="flex items-center justify-between gap-4">
                <div>
                    <p class="font-semibold text-sm">Pending Records</p>
                    <p class="text-xs text-[var(--text-secondary)]">
                        ${pendingCount} record(s) waiting to sync.
                    </p>
                </div>

                <button id="btn-force-sync" class="btn-secondary flex items-center gap-2">
                    <i class="fas fa-rotate"></i>
                    Sync Now
                </button>
            </div>
        </div>

        <div class="card border-red-200">
            <h3 class="text-lg font-bold mb-4 flex items-center gap-2 text-red-600">
                <i class="fas fa-triangle-exclamation"></i>
                Danger Zone
            </h3>

            <div class="flex items-center justify-between gap-4">
                <div>
                    <p class="font-semibold text-sm">Clear Local Data</p>
                    <p class="text-xs text-[var(--text-secondary)]">
                        Removes local offline cache from this browser only.
                    </p>
                </div>

                <button id="btn-clear-cache" class="btn-danger">
                    Clear Cache
                </button>
            </div>
        </div>
    </div>
    `;
}

export function initSettingsLogic() {
    document.getElementById('setting-dark-mode')?.addEventListener('change', (event) => {
        const enabled = event.target.checked;
        localStorage.setItem('fincapp_theme', enabled ? 'dark' : 'light');

        if (enabled) {
            document.documentElement.classList.add('dark');
            document.getElementById('theme-icon')?.classList.replace('fa-moon', 'fa-sun');
        } else {
            document.documentElement.classList.remove('dark');
            document.getElementById('theme-icon')?.classList.replace('fa-sun', 'fa-moon');
        }

        showToast(`Dark mode ${enabled ? 'enabled' : 'disabled'}`, 'info');
    });

    document.getElementById('setting-tts')?.addEventListener('change', (event) => {
        setTTS(event.target.checked);
        showToast(`AURA voice responses ${event.target.checked ? 'enabled' : 'disabled'}`, 'info');
    });

    document.getElementById('btn-force-sync')?.addEventListener('click', async () => {
        try {
            await startOfflineSync();
            showToast('Offline sync executed', 'success');
        } catch (error) {
            showToast('Could not synchronize pending records', 'warning');
        }
    });

    document.getElementById('btn-clear-cache')?.addEventListener('click', () => {
        if (!confirm('Clear all local FincApp cache from this browser?')) return;

        Object.keys(localStorage)
            .filter(key => key.startsWith('fincapp_'))
            .forEach(key => localStorage.removeItem(key));

        showToast('Local cache cleared', 'info');
    });
}
