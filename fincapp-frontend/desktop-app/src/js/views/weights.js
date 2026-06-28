/**
 * views/weights.js - Weight Control & ADG Tracking
 */
import { apiService, offlinePost, getLocal } from '../api.js';
import { calculateGDP } from '../calculations.js';
import { showToast } from '../ui-utils.js';
import { openGlobalModal, closeGlobalModal } from '../app.js';
import { speak } from '../voice-logic.js';

export function renderWeights() {
    return `
    <div class="space-y-6">
        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <h2 class="text-xl font-bold">Weight Control</h2>
                <p class="text-sm text-[var(--text-secondary)]">Track ADG (Average Daily Gain) per animal</p>
            </div>
            <button id="btn-add-weight" class="btn-primary flex items-center gap-2 text-sm">
                <i class="fas fa-plus"></i> Record Weight
            </button>
        </div>

        <!-- Quick Record Form -->
        <div class="card">
            <h3 class="font-bold text-sm mb-4 flex items-center gap-2">
                <i class="fas fa-weight-scale text-[var(--accent)]"></i> Quick Weight Entry
            </h3>
            <form id="quick-weight-form" class="flex flex-wrap gap-3 items-end">
                <div class="flex-1 min-w-32">
                    <label class="form-label">Animal Tag</label>
                    <input type="text" id="weight-tag" class="form-input" placeholder="e.g. A-101" required>
                </div>
                <div class="flex-1 min-w-32">
                    <label class="form-label">Weight (kg)</label>
                    <input type="number" id="weight-value" class="form-input" placeholder="e.g. 450" min="1" step="0.1" required>
                </div>
                <div class="flex-1 min-w-32">
                    <label class="form-label">Date</label>
                    <input type="date" id="weight-date" class="form-input" required>
                </div>
                <div>
                    <button type="submit" id="btn-quick-weight" class="btn-primary">
                        <i class="fas fa-floppy-disk mr-2"></i> Save
                    </button>
                </div>
            </form>
            <!-- ADG Result -->
            <div id="adg-result" class="hidden mt-4 p-4 bg-[var(--bg-main)] rounded-xl">
                <p class="text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">ADG Calculation Result</p>
                <div class="flex items-center gap-4">
                    <p class="text-2xl font-bold" id="adg-value">—</p>
                    <p class="text-sm" id="adg-status">—</p>
                </div>
            </div>
        </div>

        <!-- Weight History Table -->
        <div class="card p-0 overflow-hidden">
            <div class="p-4 border-b border-[var(--border-color)]">
                <h3 class="font-bold text-sm">Weight History</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Animal</th>
                            <th>Weight (kg)</th>
                            <th>Date</th>
                            <th>ADG</th>
                            <th>Performance</th>
                        </tr>
                    </thead>
                    <tbody id="weight-table-body">
                        <tr><td colspan="5" class="text-center py-8 text-[var(--text-secondary)] text-sm">
                            <i class="fas fa-spinner animate-spin text-xl mb-2 block"></i>
                            Loading...
                        </td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}

export async function initWeightsLogic() {
    let weightLogs = [];
    try {
        weightLogs = await apiService.get('weights');
    } catch {
        weightLogs = getLocal('fincapp_weights');
    }

    renderWeightTable(weightLogs);

    // Set today's date as default
    const dateInput = document.getElementById('weight-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Quick form submit
    document.getElementById('quick-weight-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-quick-weight');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner animate-spin mr-2"></i>';

        const tag = document.getElementById('weight-tag').value;
        const weight = parseFloat(document.getElementById('weight-value').value);
        const date = document.getElementById('weight-date').value;

        const data = { animal_id: tag, animal_tag: tag, current_weight: weight, weighing_date: date };

        // Calculate ADG if previous record exists
        const prevLog = weightLogs.filter(w => w.animal_id === tag || w.animal_tag === tag).slice(-1)[0];
        if (prevLog) {
            const adg = calculateGDP(weight, prevLog.current_weight, prevLog.weighing_date, date);
            const adgResult = document.getElementById('adg-result');
            const adgValue = document.getElementById('adg-value');
            const adgStatus = document.getElementById('adg-status');
            if (adgResult && adgValue && adgStatus) {
                adgResult.classList.remove('hidden');
                adgValue.textContent = `${adg.gdp} kg/day`;
                adgStatus.textContent = adg.performance;
                adgValue.className = `text-2xl font-bold ${adg.performance === 'excellent' ? 'text-green-500' : adg.performance === 'critical' ? 'text-red-500' : 'text-amber-500'}`;
            }
        }

        await offlinePost('weights', data, 'fincapp_weights');
        weightLogs.unshift({ ...data, id: Date.now() });
        renderWeightTable(weightLogs);
        showToast(`Weight recorded: ${weight}kg for Animal #${tag}`, 'success');
        speak(`Weight of ${weight} kilograms recorded for animal number ${tag}`);
        e.target.reset();
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-floppy-disk mr-2"></i> Save';
    });
}

function renderWeightTable(logs) {
    const tbody = document.getElementById('weight-table-body');
    if (!tbody) return;

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-[var(--text-secondary)] text-sm">
            No weight records yet.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = logs.slice(0, 50).map((log, idx) => {
        const prevLog = logs[idx + 1];
        let adgDisplay = '—';
        let perfClass = '';
        if (prevLog && (prevLog.animal_id === log.animal_id || prevLog.animal_tag === log.animal_tag)) {
            const adg = calculateGDP(log.current_weight, prevLog.current_weight, prevLog.weighing_date, log.weighing_date);
            adgDisplay = `${adg.gdp} kg/day`;
            perfClass = adg.performance === 'excellent' ? 'text-green-500' : adg.performance === 'critical' ? 'text-red-500' : 'text-amber-500';
        }
        const date = log.weighing_date ? new Date(log.weighing_date).toLocaleDateString('en-US') : '—';
        return `
        <tr>
            <td class="font-bold">#${log.animal_tag || log.animal_id}</td>
            <td>${log.current_weight} kg</td>
            <td class="text-[var(--text-secondary)]">${date}</td>
            <td class="${perfClass} font-semibold">${adgDisplay}</td>
            <td>${perfClass ? `<span class="${perfClass.includes('green') ? 'badge-safe' : perfClass.includes('red') ? 'badge-critical' : 'badge-warning'}">${logs[idx + 1] ? calculateGDP(log.current_weight, logs[idx + 1].current_weight, logs[idx + 1].weighing_date, log.weighing_date).performance : '—'}</span>` : '—'}</td>
        </tr>`;
    }).join('');
}
