/**
 * views/inventory.js - Livestock Inventory CRUD View
 */

import { apiService, offlinePost, getLocal, deleteLocal, saveToPython, fetchFromPython } from '../api.js';
import { showToast } from '../ui-utils.js';
import { isAdmin } from '../auth.js';
import { openGlobalModal, closeGlobalModal } from '../app.js';
import { speak } from '../voice-logic.js';

export function renderInventory() {
    return `
    <div class="space-y-6">

        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <h2 class="text-xl font-bold">Livestock Inventory</h2>
                <p class="text-sm text-[var(--text-secondary)]">Manage and track your herd</p>
            </div>
            <div class="flex gap-3">
                <button id="btn-export-pdf" class="btn-secondary flex items-center gap-2 text-sm">
                    <i class="fas fa-file-pdf"></i> Export PDF
                </button>
                <button id="btn-new-animal" class="btn-primary flex items-center gap-2 text-sm">
                    <i class="fas fa-plus"></i> Add Animal
                </button>
            </div>
        </div>

        <!-- Search & Filter -->
        <div class="card p-4">
            <div class="flex flex-wrap gap-3">
                <input type="text" id="search-animals" class="form-input flex-1 min-w-48" placeholder="Search by tag, breed...">
                <select id="filter-status" class="form-input w-40">
                    <option value="">All Status</option>
                    <option value="healthy">Healthy</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                </select>
            </div>
        </div>

        <!-- Table -->
        <div class="card p-0 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Tag #</th>
                            <th>Breed</th>
                            <th>Birth Date</th>
                            <th>Last Weight</th>
                            <th>Status</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="livestock-table-body">
                        <tr><td colspan="6" class="text-center py-10 text-[var(--text-secondary)]">
                            <i class="fas fa-spinner animate-spin text-2xl mb-3 block"></i>
                            Loading livestock data...
                        </td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
}

export async function initInventoryLogic() {
    let allAnimals = [];

    // Load data
    try {
        allAnimals = await fetchFromPython();
        if (!allAnimals || allAnimals.length === 0) {
            allAnimals = await apiService.get('livestock');
        }
    } catch {
        allAnimals = getLocal('fincapp_livestock');
    }

    renderTable(allAnimals);

    // Search
    document.getElementById('search-animals')?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = allAnimals.filter(a =>
            String(a.tag_number || a.tag || a.id).toLowerCase().includes(q) ||
            (a.breed || '').toLowerCase().includes(q)
        );
        renderTable(filtered);
    });

    // Filter by status
    document.getElementById('filter-status')?.addEventListener('change', (e) => {
        const status = e.target.value;
        const filtered = status ? allAnimals.filter(a => a.status === status) : allAnimals;
        renderTable(filtered);
    });

    // New animal button
    document.getElementById('btn-new-animal')?.addEventListener('click', () => {
        openAnimalForm(null, async (data) => {
            const result = await offlinePost('livestock', data, 'fincapp_livestock');
            await saveToPython(data);
            showToast('Animal registered successfully!', 'success');
            speak(`Animal number ${data.tag_number} registered successful`);
            closeGlobalModal();
            allAnimals.push({ ...data, id: Date.now() });
            renderTable(allAnimals);
        });
    });

    // Export PDF
    document.getElementById('btn-export-pdf')?.addEventListener('click', async () => {
        const { exportInventoryToPDF } = await import('../ui-utils.js');
        exportInventoryToPDF(allAnimals);
    });
}

function renderTable(animals) {
    const tbody = document.getElementById('livestock-table-body');
    if (!tbody) return;

    if (animals.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-[var(--text-secondary)]">
            <i class="fas fa-cow text-4xl mb-3 block opacity-20"></i>
            No animals found. Add your first one!
        </td></tr>`;
        return;
    }

    tbody.innerHTML = animals.map(animal => {
        const tag = animal.tag_number || animal.tag || animal.id;
        const breed = animal.breed || '—';
        const birth = animal.birth_date ? new Date(animal.birth_date).toLocaleDateString('en-US') : '—';
        const weight = animal.last_weight || animal.weight || '—';
        const status = animal.status || 'healthy';
        const badgeClass = status === 'critical' ? 'badge-critical' : status === 'warning' ? 'badge-warning' : 'badge-safe';

        const deleteBtn = isAdmin()
            ? `<button onclick="deleteAnimal(${animal.id || `'${tag}'`})" class="btn-danger text-xs px-2 py-1">
                <i class="fas fa-trash"></i>
               </button>`
            : '';

        return `
        <tr>
            <td class="font-bold">#${tag}</td>
            <td>${breed}</td>
            <td class="text-[var(--text-secondary)]">${birth}</td>
            <td>${weight !== '—' ? weight + ' kg' : '—'}</td>
            <td><span class="${badgeClass}">${status}</span></td>
            <td class="text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="editAnimal('${tag}', ${JSON.stringify(animal).replace(/'/g, "\\'")})" 
                        class="text-[var(--accent)] hover:text-[var(--accent-dark)] transition text-sm px-2 py-1 rounded-lg hover:bg-[var(--accent-light)]">
                        <i class="fas fa-pen"></i>
                    </button>
                    ${deleteBtn}
                </div>
            </td>
        </tr>`;
    }).join('');

    // Expose global helpers
    window.editAnimal = (tag, animal) => {
        openAnimalForm(animal, async (data) => {
            await offlinePost(`livestock/${tag}`, data);
            showToast('Animal updated', 'success');
            speak(`Animal ${tag} updated successful.`);
            closeGlobalModal();
        }, true);
    };

    window.deleteAnimal = async (id) => {
        if (!confirm('Delete this animal? This action cannot be undone.')) return;
        try {
            await apiService.delete(`livestock/${id}`);
            deleteLocal('fincapp_livestock', id);
            showToast('Animal deleted', 'info');
            speak(`Animal Deleted from the inventory`);
            const updated = animals.filter(a => (a.id || a.tag) !== id);
            renderTable(updated);
        } catch (err) {
            showToast('Failed to delete: ' + err.message, 'error');
        }
    };
}

function openAnimalForm(animal, onSubmit, isEdit = false) {
    openGlobalModal(`
        <div class="p-6">
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-lg font-bold">${isEdit ? 'Edit Animal' : 'Register New Animal'}</h3>
                <button onclick="closeModal()" class="text-[var(--text-secondary)] hover:text-red-500 text-xl">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="animal-form" class="space-y-4">
                <div>
                    <label class="form-label">Tag Number</label>
                    <input type="text" id="f-tag" class="form-input" placeholder="e.g. A-101" required
                        value="${animal?.tag_number || animal?.tag || ''}">
                </div>
                <div>
                    <label class="form-label">Breed</label>
                    <input type="text" id="f-breed" class="form-input" placeholder="e.g. Brahman, Angus"
                        value="${animal?.breed || ''}">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Birth Date</label>
                        <input type="date" id="f-birth" class="form-input"
                            value="${animal?.birth_date || ''}">
                    </div>
                    <div>
                        <label class="form-label">Initial Weight (kg)</label>
                        <input type="number" id="f-weight" class="form-input" placeholder="e.g. 280" min="1"
                            value="${animal?.weight || ''}">
                    </div>
                </div>
                <div>
                    <label class="form-label">Health Status</label>
                    <select id="f-status" class="form-input">
                        <option value="healthy" ${animal?.status === 'healthy' ? 'selected' : ''}>Healthy</option>
                        <option value="warning" ${animal?.status === 'warning' ? 'selected' : ''}>Warning</option>
                        <option value="critical" ${animal?.status === 'critical' ? 'selected' : ''}>Critical</option>
                    </select>
                </div>
                <div class="flex gap-3 pt-2">
                    <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancel</button>
                    <button type="submit" class="btn-primary flex-1">${isEdit ? 'Save Changes' : 'Register Animal'}</button>
                </div>
            </form>
        </div>
    `);

    document.getElementById('animal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            tag_number: document.getElementById('f-tag').value,
            tag: document.getElementById('f-tag').value,
            breed: document.getElementById('f-breed').value,
            birth_date: document.getElementById('f-birth').value,
            weight: parseFloat(document.getElementById('f-weight').value) || 0,
            status: document.getElementById('f-status').value,
        };
        await onSubmit(data);
    });
}
