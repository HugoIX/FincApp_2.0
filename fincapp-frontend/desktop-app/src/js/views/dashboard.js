/**
 * views/dashboard.js - FincApp 2.0 Administrator Dashboard MVP
 * Shows synchronized livestock KPIs with API, local storage, and stable demo fallback.
 */

import { getDashboardSummary, getDashboardFarms, getPendingCount } from '../api.js';
import { getCurrentUser } from '../auth.js';

let weightChart = null;
let typeChart = null;

const TYPE_LABELS = {
    cattle: 'Cattle',
    swine: 'Swine',
    poultry: 'Poultry'
};

export function renderDashboard() {
    const user = getCurrentUser();

    return `
    <div class="space-y-6">
        <div class="card aura-card border-0">
            <div class="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <p class="text-xs uppercase font-black tracking-widest text-[var(--accent-dark)] dark:text-green-300">FincApp 2.0 — Powered by AURA</p>
                    <h2 class="text-2xl font-bold font-display mt-1">Administrator livestock dashboard</h2>
                    <p class="text-sm text-[var(--text-secondary)] mt-1">
                        Good day, ${user?.full_name || 'Administrator'}. Review synchronized inventory, weight performance, health alerts, and recent activity.
                    </p>
                </div>
                <div class="flex items-end gap-3 flex-wrap">
                    <div>
                        <label class="form-label">Active farm</label>
                        <select id="dashboard-farm-filter" class="form-input farm-selector">
                            <option value="all">Loading farms...</option>
                        </select>
                    </div>
                    <button id="btn-dashboard-refresh" class="btn-primary">
                        <i class="fas fa-rotate mr-2"></i> Refresh
                    </button>
                </div>
            </div>
        </div>

        <div id="dashboard-empty-state" class="card dashboard-empty-state hidden">
            <div class="w-16 h-16 rounded-2xl bg-[var(--accent-light)] flex items-center justify-center mb-4">
                <i class="fas fa-database text-2xl text-[var(--accent)]"></i>
            </div>
            <h3 class="text-xl font-bold">No synchronized livestock data yet</h3>
            <p class="text-sm text-[var(--text-secondary)] max-w-xl mt-2">
                This farm has no synchronized records. Register animals, weights, or health alerts with AURA in the Android APK, then synchronize to populate this dashboard.
            </p>
        </div>

        <div id="dashboard-content" class="space-y-6">
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-4" id="kpi-cards">
                <div class="stat-card">
                    <p class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">Total Animals</p>
                    <p class="text-3xl font-bold text-[var(--text-primary)]" id="kpi-total">--</p>
                    <p class="text-xs text-[var(--text-secondary)]">Synchronized inventory</p>
                </div>
                <div class="stat-card">
                    <p class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">Average Weight</p>
                    <p class="text-3xl font-bold text-[var(--accent)]" id="kpi-average-weight">--</p>
                    <p class="text-xs text-[var(--text-secondary)]">Latest logs</p>
                </div>
                <div class="stat-card" id="health-alert-card">
                    <p class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">Health Alerts</p>
                    <p class="text-3xl font-bold text-red-500" id="kpi-alerts">--</p>
                    <p class="text-xs text-[var(--text-secondary)]" id="health-alert-copy">Need attention</p>
                </div>
                <div class="stat-card">
                    <p class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">Pending Sync</p>
                    <p class="text-3xl font-bold text-amber-500" id="kpi-pending-sync">--</p>
                    <p class="text-xs text-[var(--text-secondary)]">Offline queue</p>
                </div>
                <div class="stat-card">
                    <p class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">Last Sync</p>
                    <p class="text-base font-bold text-[var(--text-primary)]" id="kpi-last-sync">--</p>
                    <p class="text-xs text-[var(--text-secondary)]">Dashboard update</p>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="card lg:col-span-1">
                    <h3 class="font-bold mb-4 flex items-center gap-2 text-sm">
                        <i class="fas fa-chart-pie text-[var(--accent)]"></i> Animals by type
                    </h3>
                    <div class="h-56">
                        <canvas id="animalsTypeChart"></canvas>
                    </div>
                    <div id="animals-type-bars" class="space-y-3 mt-5"></div>
                </div>

                <div class="card lg:col-span-2">
                    <h3 class="font-bold mb-4 flex items-center gap-2 text-sm">
                        <i class="fas fa-chart-line text-[var(--accent)]"></i> Weight trend
                    </h3>
                    <div class="h-72">
                        <canvas id="dashboardWeightTrendChart"></canvas>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="card">
                    <h3 class="font-bold mb-4 flex items-center gap-2 text-sm">
                        <i class="fas fa-triangle-exclamation text-red-500"></i> Active health alerts
                    </h3>
                    <div id="dashboard-alerts" class="space-y-3"></div>
                </div>

                <div class="card">
                    <h3 class="font-bold mb-4 flex items-center gap-2 text-sm">
                        <i class="fas fa-clock-rotate-left text-[var(--accent)]"></i> Recent activity
                    </h3>
                    <div id="dashboard-activity" class="space-y-3"></div>
                </div>
            </div>

            <div class="card aura-card">
                <div class="flex items-start gap-4">
                    <div class="w-11 h-11 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div>
                        <p class="text-xs uppercase tracking-widest font-black text-[var(--accent)]">AURA operational insight</p>
                        <p id="aura-dashboard-insight" class="text-sm text-[var(--text-secondary)] mt-1">Loading insight...</p>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

export async function initDashboardLogic() {
    await loadFarmOptions();
    await refreshDashboard();

    document.getElementById('dashboard-farm-filter')?.addEventListener('change', refreshDashboard);
    document.getElementById('btn-dashboard-refresh')?.addEventListener('click', refreshDashboard);
}

async function loadFarmOptions() {
    const select = document.getElementById('dashboard-farm-filter');
    if (!select) return;

    const farms = await getDashboardFarms();
    select.innerHTML = farms.map(farm => `<option value="${escapeHtml(farm.id)}">${escapeHtml(farm.name)}</option>`).join('');
}

async function refreshDashboard() {
    const farmId = document.getElementById('dashboard-farm-filter')?.value || 'all';
    const summary = await getDashboardSummary(farmId);
    renderSummary(summary);
}

function renderSummary(summary) {
    const emptyState = document.getElementById('dashboard-empty-state');
    const content = document.getElementById('dashboard-content');

    const isEmpty = summary.empty || Number(summary.total_animals || 0) === 0 && !summary.health_alerts?.length && !summary.recent_activity?.length;
    emptyState?.classList.toggle('hidden', !isEmpty);
    content?.classList.toggle('hidden', isEmpty);

    if (isEmpty) return;

    setText('kpi-total', summary.total_animals ?? 0);
    setText('kpi-average-weight', `${Number(summary.average_weight || 0).toFixed(1)} kg`);
    setText('kpi-alerts', summary.health_alerts_count ?? 0);
    setText('kpi-pending-sync', summary.pending_sync ?? getPendingCount());
    setText('kpi-last-sync', summary.last_sync ? new Date(summary.last_sync).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--');

    const healthCard = document.getElementById('health-alert-card');
    const hasAlerts = Number(summary.health_alerts_count || 0) > 0;
    healthCard?.classList.toggle('dashboard-alert-card', hasAlerts);
    healthCard?.classList.toggle('kpi-danger', hasAlerts);
    setText('health-alert-copy', hasAlerts ? 'Requires administrator review' : 'No active alerts');

    renderTypeBars(summary.animals_by_type || []);
    renderTypeChart(summary.animals_by_type || []);
    renderWeightTrend(summary.weight_trend || []);
    renderAlerts(summary.health_alerts || []);
    renderActivity(summary.recent_activity || []);
    renderAuraInsight(summary);
}

function renderTypeBars(rows) {
    const container = document.getElementById('animals-type-bars');
    if (!container) return;

    const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0) || 1;
    container.innerHTML = rows.length ? rows.map(row => {
        const type = row.animal_type || row.type || 'cattle';
        const count = Number(row.total || 0);
        const percent = Math.round((count / total) * 100);
        return `
        <div>
            <div class="flex items-center justify-between text-xs font-bold mb-1">
                <span>${TYPE_LABELS[type] || type}</span>
                <span>${count} (${percent}%)</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
        </div>`;
    }).join('') : `<p class="text-sm text-[var(--text-secondary)]">No animal type data available.</p>`;
}

function renderTypeChart(rows) {
    const canvas = document.getElementById('animalsTypeChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');

    if (typeChart) typeChart.destroy();

    const labels = rows.map(row => TYPE_LABELS[row.animal_type] || row.animal_type || 'Unknown');
    const data = rows.map(row => Number(row.total || 0));

    typeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: ['#2d7a2d', '#d97706', '#2563eb'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            cutout: '68%'
        }
    });
}

function renderWeightTrend(rows) {
    const canvas = document.getElementById('dashboardWeightTrendChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');

    if (weightChart) weightChart.destroy();

    const labels = rows.length ? rows.map(row => row.label || row.weighing_date || '') : ['No data'];
    const data = rows.length ? rows.map(row => Number(row.value || row.average_weight || row.current_weight || 0)) : [0];

    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Average weight (kg)',
                data,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2d7a2d',
                backgroundColor: 'rgba(45, 122, 45, 0.10)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#2d7a2d'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: false }
            }
        }
    });
}

function renderAlerts(alerts) {
    const container = document.getElementById('dashboard-alerts');
    if (!container) return;

    if (!alerts.length) {
        container.innerHTML = `<div class="text-center py-8 text-[var(--text-secondary)] text-sm">
            <i class="fas fa-shield-heart text-3xl mb-3 block opacity-20"></i>
            No active health alerts.
        </div>`;
        return;
    }

    container.innerHTML = alerts.map(alert => {
        const severity = String(alert.severity || alert.alert_level || 'low').toLowerCase();
        const cls = severity === 'high' ? 'badge-critical' : severity === 'medium' ? 'badge-warning' : 'badge-safe';
        const tag = alert.tag_number || alert.animal_tag || alert.animal_id || '—';
        return `
        <div class="card p-4 ${severity === 'high' ? 'dashboard-alert-card' : ''}">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <p class="font-bold text-sm">Animal #${escapeHtml(tag)}</p>
                    <p class="text-xs text-[var(--text-secondary)] mt-1">${escapeHtml(alert.description || alert.symptoms_description || alert.ai_diagnosis || 'Health observation')}</p>
                </div>
                <span class="${cls}">${escapeHtml(severity)}</span>
            </div>
        </div>`;
    }).join('');
}

function renderActivity(items) {
    const container = document.getElementById('dashboard-activity');
    if (!container) return;

    if (!items.length) {
        container.innerHTML = `<div class="text-center py-8 text-[var(--text-secondary)] text-sm">
            <i class="fas fa-clipboard-list text-3xl mb-3 block opacity-20"></i>
            No recent activity.
        </div>`;
        return;
    }

    container.innerHTML = items.map(item => {
        const date = item.created_at ? new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent';
        return `
        <div class="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-main)]">
            <div class="w-9 h-9 rounded-xl bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
                <i class="fas fa-circle-check"></i>
            </div>
            <div class="flex-1">
                <p class="font-bold text-sm">${escapeHtml(item.event_type || item.type || 'Activity')}</p>
                <p class="text-xs text-[var(--text-secondary)]">${escapeHtml(item.description || 'Operation recorded')} · ${date}</p>
            </div>
        </div>`;
    }).join('');
}

function renderAuraInsight(summary) {
    const insight = document.getElementById('aura-dashboard-insight');
    if (!insight) return;

    const alerts = Number(summary.health_alerts_count || 0);
    const pending = Number(summary.pending_sync || 0);
    const animals = Number(summary.total_animals || 0);

    if (alerts > 0) {
        insight.textContent = `AURA detected ${alerts} active health alert(s). Prioritize animal welfare review before presenting productivity metrics.`;
    } else if (pending > 0) {
        insight.textContent = `AURA detected ${pending} pending offline record(s). Synchronize the Android APK to keep administrator KPIs current.`;
    } else {
        insight.textContent = `AURA reports ${animals} synchronized animal(s) and stable dashboard data for the selected farm.`;
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
