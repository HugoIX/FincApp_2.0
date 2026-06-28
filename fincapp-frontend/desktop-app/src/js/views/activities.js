/**
 * views/activities.js - Farm Activity Log
 */
import { apiService, offlinePost, getLocal } from '../api.js';
import { showToast } from '../ui-utils.js';
import { openGlobalModal, closeGlobalModal } from '../app.js';
import { speak } from '../voice-logic.js';

const ACTIVITY_TYPES = ['Feed', 'Bath', 'Repair', 'Movement', 'Pregnancy Check', 'Milking', 'Deworming', 'Other'];

export function renderActivities() {
    return `
    <div class="space-y-6">
        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <h2 class="text-xl font-bold">Farm Activities</h2>
                <p class="text-sm text-[var(--text-secondary)]">Daily farm operations log</p>
            </div>
            <button id="btn-add-activity" class="btn-primary flex items-center gap-2 text-sm">
                <i class="fas fa-plus"></i> Log Activity
            </button>
        </div>

        <!-- Filter -->
        <div class="card p-4">
            <div class="flex flex-wrap gap-3 items-center">
                <input type="text" id="activity-search" class="form-input flex-1 min-w-48" placeholder="Search activities...">
                <select id="activity-type-filter" class="form-input w-44">
                    <option value="">All Types</option>
                    ${ACTIVITY_TYPES.map(t => `<option>${t}</option>`).join('')}
                </select>
                <input type="date" id="activity-date-filter" class="form-input w-44">
            </div>
        </div>

        <!-- Activity List -->
        <div id="activity-list" class="space-y-3">
            <div class="text-center py-10 text-[var(--text-secondary)]">
                <i class="fas fa-spinner animate-spin text-2xl mb-3 block"></i>
                Loading activities...
            </div>
        </div>
    </div>`;
}

export async function initActivitiesLogic() {
    let activities = [];
    try {
        activities = await apiService.get('activities');
    } catch {
        activities = getLocal('fincapp_activities');
    }

    renderActivityList(activities);

    document.getElementById('btn-add-activity')?.addEventListener('click', () => {
        openActivityForm(async (data) => {
            await offlinePost('activities', data, 'fincapp_activities');
            activities.unshift({ ...data, id: Date.now() });
            renderActivityList(activities);
            showToast('Activity logged!', 'success');
            speak(`${data.event_type} activity successfully recorded`);
            closeGlobalModal();
        });
    });

    const refilter = () => {
        const q = document.getElementById('activity-search')?.value.toLowerCase() || '';
        const type = document.getElementById('activity-type-filter')?.value || '';
        const date = document.getElementById('activity-date-filter')?.value || '';
        const filtered = activities.filter(a =>
            (a.description || '').toLowerCase().includes(q) &&
            (!type || a.event_type === type) &&
            (!date || (a.created_at || '').startsWith(date))
        );
        renderActivityList(filtered);
    };

    document.getElementById('activity-search')?.addEventListener('input', refilter);
    document.getElementById('activity-type-filter')?.addEventListener('change', refilter);
    document.getElementById('activity-date-filter')?.addEventListener('change', refilter);
}

function renderActivityList(activities) {
    const container = document.getElementById('activity-list');
    if (!container) return;

    if (activities.length === 0) {
        container.innerHTML = `<div class="card text-center py-10 text-[var(--text-secondary)]">
            <i class="fas fa-clipboard-list text-4xl mb-3 opacity-20"></i>
            <p>No activities found. Start logging farm operations!</p>
        </div>`;
        return;
    }

    const icons = { Feed: 'fa-seedling', Bath: 'fa-shower', Repair: 'fa-wrench',
        Movement: 'fa-arrows-left-right', Milking: 'fa-cow', Deworming: 'fa-syringe', Other: 'fa-circle-dot' };

    container.innerHTML = activities.map(a => {
        const icon = icons[a.event_type] || 'fa-circle-dot';
        const date = a.created_at ? new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent';
        return `
        <div class="card p-4 flex items-start gap-4">
            <div class="w-10 h-10 bg-[var(--accent-light)] rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <i class="fas ${icon} text-[var(--accent)]"></i>
            </div>
            <div class="flex-1">
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <span class="badge-safe text-[10px]">${a.event_type || 'Activity'}</span>
                        <p class="font-semibold text-sm mt-1">${a.description || '—'}</p>
                        <p class="text-xs text-[var(--text-secondary)] mt-0.5">Animal #${a.animal_id || '—'} · ${date}</p>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function openActivityForm(onSubmit) {
    openGlobalModal(`
        <div class="p-6">
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-lg font-bold">Log Farm Activity</h3>
                <button onclick="closeModal()" class="text-[var(--text-secondary)] hover:text-red-500 text-xl">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="activity-form" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Activity Type</label>
                        <select id="a-type" class="form-input" required>
                            ${ACTIVITY_TYPES.map(t => `<option>${t}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Animal ID (optional)</label>
                        <input type="text" id="a-animal" class="form-input" placeholder="Tag or leave blank">
                    </div>
                </div>
                <div>
                    <label class="form-label">Description</label>
                    <textarea id="a-desc" class="form-input h-24 resize-none" placeholder="What was done?" required></textarea>
                </div>
                <div class="flex gap-3 pt-2">
                    <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancel</button>
                    <button type="submit" class="btn-primary flex-1">Log Activity</button>
                </div>
            </form>
        </div>
    `);

    document.getElementById('activity-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await onSubmit({
            event_type: document.getElementById('a-type').value,
            animal_id: document.getElementById('a-animal').value || null,
            description: document.getElementById('a-desc').value,
            created_at: new Date().toISOString(),
        });
    });
}
