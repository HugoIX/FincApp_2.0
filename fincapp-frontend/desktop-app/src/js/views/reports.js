/**
 * views/reports.js - PDF Export & Analytics Reports
 */
import { apiService, getLocal } from '../api.js';
import { showToast, exportInventoryToPDF } from '../ui-utils.js';

export function renderReports() {
    return `
    <div class="space-y-6">
        <div>
            <h2 class="text-xl font-bold">Reports & Exports</h2>
            <p class="text-sm text-[var(--text-secondary)]">Generate PDF reports for all farm areas</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            <div class="card hover:shadow-lg transition cursor-pointer" onclick="generateReport('inventory')">
                <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                    <i class="fas fa-cow text-green-600 text-xl"></i>
                </div>
                <h3 class="font-bold mb-1">Livestock Inventory</h3>
                <p class="text-sm text-[var(--text-secondary)] mb-4">Complete herd list with status</p>
                <span class="text-xs text-[var(--accent)] font-bold flex items-center gap-1">
                    <i class="fas fa-file-pdf"></i> Export PDF
                </span>
            </div>

            <div class="card hover:shadow-lg transition cursor-pointer" onclick="generateReport('health')">
                <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                    <i class="fas fa-heart-pulse text-blue-600 text-xl"></i>
                </div>
                <h3 class="font-bold mb-1">Health Report</h3>
                <p class="text-sm text-[var(--text-secondary)] mb-4">Vaccines, treatments & alerts</p>
                <span class="text-xs text-[var(--accent)] font-bold flex items-center gap-1">
                    <i class="fas fa-file-pdf"></i> Export PDF
                </span>
            </div>

            <div class="card hover:shadow-lg transition cursor-pointer" onclick="generateReport('weights')">
                <div class="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                    <i class="fas fa-weight-scale text-amber-600 text-xl"></i>
                </div>
                <h3 class="font-bold mb-1">Weight & Growth</h3>
                <p class="text-sm text-[var(--text-secondary)] mb-4">ADG trends and performance</p>
                <span class="text-xs text-[var(--accent)] font-bold flex items-center gap-1">
                    <i class="fas fa-file-pdf"></i> Export PDF
                </span>
            </div>

            <div class="card hover:shadow-lg transition cursor-pointer" onclick="generateReport('activities')">
                <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                    <i class="fas fa-clipboard-list text-purple-600 text-xl"></i>
                </div>
                <h3 class="font-bold mb-1">Activity Log</h3>
                <p class="text-sm text-[var(--text-secondary)] mb-4">All farm operations</p>
                <span class="text-xs text-[var(--accent)] font-bold flex items-center gap-1">
                    <i class="fas fa-file-pdf"></i> Export PDF
                </span>
            </div>

            <div class="card col-span-full md:col-span-2 hover:shadow-lg transition cursor-pointer border-2 border-[var(--accent)] border-dashed" onclick="generateReport('full')">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-[var(--accent)] rounded-xl flex items-center justify-center">
                        <i class="fas fa-file-chart-column text-white text-xl"></i>
                    </div>
                    <div>
                        <h3 class="font-bold">Full Farm Report</h3>
                        <p class="text-sm text-[var(--text-secondary)]">Complete monthly overview — all sections combined</p>
                    </div>
                    <span class="ml-auto text-xs text-white bg-[var(--accent)] px-3 py-1.5 rounded-lg font-bold">
                        <i class="fas fa-file-pdf mr-1"></i> Full Export
                    </span>
                </div>
            </div>
        </div>
    </div>`;
}

export async function initReportsLogic() {
    window.generateReport = async (type) => {
        showToast(`Generating ${type} report...`, 'info');
        try {
            let data = [];
            switch (type) {
                case 'inventory': data = await safeGet('livestock', 'fincapp_livestock'); break;
                case 'health':    data = await safeGet('health-records', 'fincapp_health_records'); break;
                case 'weights':   data = await safeGet('weights', 'fincapp_weights'); break;
                case 'activities':data = await safeGet('activities', 'fincapp_activities'); break;
                case 'full': {
                    const inv = await safeGet('livestock', 'fincapp_livestock');
                    exportInventoryToPDF(inv);
                    return;
                }
            }
            exportInventoryToPDF(data, type);
            showToast('Report generated!', 'success');
        } catch (err) {
            showToast('Export failed: ' + err.message, 'error');
        }
    };

    async function safeGet(endpoint, localKey) {
        try { return await apiService.get(endpoint); }
        catch { return getLocal(localKey); }
    }
}
