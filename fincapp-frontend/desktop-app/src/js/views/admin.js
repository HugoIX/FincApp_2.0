/**
 * views/admin.js - Admin Panel (role-protected)
 */
import { apiService, getLocal } from '../api.js';
import { requireRole, isAdmin } from '../auth.js';
import { showToast } from '../ui-utils.js';
import { speak } from '../voice-logic.js';

export function renderAdmin() {
    if (!isAdmin()) {
        return `<div class="card text-center py-20">
            <i class="fas fa-shield-halved text-4xl text-red-400 mb-4"></i>
            <p class="font-bold text-lg">Access Denied</p>
            <p class="text-sm text-[var(--text-secondary)] mt-1">Admin role required</p>
        </div>`;
    }

    return `
    <div class="space-y-6">
        <div>
            <h2 class="text-xl font-bold">Admin Panel</h2>
            <p class="text-sm text-[var(--text-secondary)]">System overview and user management</p>
        </div>

        <!-- Farm-wide Stats -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4" id="admin-stats">
            <div class="stat-card"><p class="text-xs font-bold text-[var(--text-secondary)] uppercase">Total Users</p>
                <p class="text-3xl font-bold" id="stat-users">—</p></div>
            <div class="stat-card"><p class="text-xs font-bold text-[var(--text-secondary)] uppercase">Total Animals</p>
                <p class="text-3xl font-bold text-[var(--accent)]" id="stat-animals">—</p></div>
            <div class="stat-card"><p class="text-xs font-bold text-[var(--text-secondary)] uppercase">Total Activities</p>
                <p class="text-3xl font-bold text-blue-500" id="stat-activities">—</p></div>
            <div class="stat-card"><p class="text-xs font-bold text-[var(--text-secondary)] uppercase">Health Alerts</p>
                <p class="text-3xl font-bold text-red-500" id="stat-alerts">—</p></div>
        </div>

        <!-- Filters -->
        <div class="card">
            <h3 class="font-bold text-sm mb-4">Filter Records</h3>
            <div class="flex flex-wrap gap-3">
                <select id="admin-filter-farm" class="form-input w-44">
                    <option value="">All Farms</option>
                </select>
                <select id="admin-filter-worker" class="form-input w-44">
                    <option value="">All Workers</option>
                </select>
                <select id="admin-filter-section" class="form-input w-44">
                    <option value="">All Sections</option>
                    <option>Livestock</option>
                    <option>Health</option>
                    <option>Activities</option>
                    <option>Weights</option>
                </select>
            </div>
        </div>

        <!-- User Management -->
        <div class="card p-0 overflow-hidden">
            <div class="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
                <h3 class="font-bold text-sm">User Management</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Farm</th>
                            <th>Role</th>
                            <th>Joined</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="users-table-body">
                        <tr><td colspan="6" class="text-center py-8 text-[var(--text-secondary)] text-sm">
                            <i class="fas fa-spinner animate-spin text-xl mb-2 block"></i>
                            Loading users...
                        </td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}

export async function initAdminLogic() {
    if (!isAdmin()) return;

    let users = [], animals = [], activities = [], healthRecords = [];

    try { users = await apiService.get('users'); } catch { users = []; }
    try { animals = await apiService.get('livestock'); } catch { animals = getLocal('fincapp_livestock'); }
    try { activities = await apiService.get('activities'); } catch { activities = getLocal('fincapp_activities'); }
    try { healthRecords = await apiService.get('health-records'); } catch { healthRecords = getLocal('fincapp_health_records'); }

    // Stats
    document.getElementById('stat-users').textContent = users.length;
    document.getElementById('stat-animals').textContent = animals.length;
    document.getElementById('stat-activities').textContent = activities.length;
    document.getElementById('stat-alerts').textContent = healthRecords.filter(r => r.alert_level === 'high').length;

    // Users table
    const tbody = document.getElementById('users-table-body');
    if (tbody) {
        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-[var(--text-secondary)] text-sm">No users found</td></tr>`;
        } else {
            tbody.innerHTML = users.map(u => `
            <tr>
                <td class="font-semibold">${u.full_name || '—'}</td>
                <td class="text-[var(--text-secondary)]">${u.email}</td>
                <td>${u.farm_name || '—'}</td>
                <td><span class="${u.role === 'admin' ? 'badge-critical' : 'badge-safe'}">${u.role}</span></td>
                <td class="text-[var(--text-secondary)]">${u.created_at ? new Date(u.created_at).toLocaleDateString('en-US') : '—'}</td>
                <td class="text-right">
                    <button onclick="deleteUser(${u.id})" class="btn-danger text-xs">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>`).join('');
        }
    }

    window.deleteUser = async (id) => {
        if (!confirm('Delete this user? This cannot be undone.')) return;
        try {
            await apiService.delete(`users/${id}`);
            showToast('User deleted', 'info');
            speak('User removed from the system');
            const updated = users.filter(u => u.id !== id);
            document.getElementById('stat-users').textContent = updated.length;
        } catch (err) {
            showToast('Delete failed: ' + err.message, 'error');
        }
    };
}
