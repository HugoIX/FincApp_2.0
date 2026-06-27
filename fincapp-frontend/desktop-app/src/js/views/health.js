/**
 * views/health.js - Health & Vaccines Module
 * Traffic light alert system + AI diagnosis + vaccination schedule.
 */

import { apiService, offlinePost, getLocal } from '../api.js';
import { showToast } from '../ui-utils.js';
import { getAIDiagnosis, speak } from '../voice-logic.js';
import { openGlobalModal, closeGlobalModal } from '../app.js';

export function renderHealth() {
    return `
    <div class="space-y-6">

        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <h2 class="text-xl font-bold">Health & Vaccines</h2>
                <p class="text-sm text-[var(--text-secondary)]">Colombian livestock vaccination schedule & health tracking</p>
            </div>
            <button id="btn-add-vaccine" class="btn-primary flex items-center gap-2 text-sm">
                <i class="fas fa-syringe"></i> Schedule Vaccine
            </button>
        </div>

        <!-- Alert Summary Banner -->
        <div id="alert-banner" class="hidden card border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 p-4">
            <div class="flex items-center gap-3">
                <i class="fas fa-triangle-exclamation text-red-500 text-xl"></i>
                <div>
                    <p class="font-bold text-red-700 dark:text-red-300" id="alert-banner-text"></p>
                    <p class="text-xs text-red-600 dark:text-red-400">Take action immediately</p>
                </div>
            </div>
        </div>

        <!-- Vaccine Status Cards -->
        <div>
            <h3 class="font-bold text-sm mb-3 text-[var(--text-secondary)] uppercase tracking-wide">Vaccination Schedule</h3>
            <div id="vaccine-list" class="space-y-3">
                <div class="text-center py-10 text-[var(--text-secondary)]">
                    <i class="fas fa-spinner animate-spin text-2xl mb-3 block"></i>
                    Loading vaccination records...
                </div>
            </div>
        </div>

        <!-- Health Records Table -->
        <div class="card p-0 overflow-hidden">
            <div class="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
                <h3 class="font-bold text-sm">Health Records</h3>
                <button id="btn-add-health" class="btn-secondary text-xs flex items-center gap-1">
                    <i class="fas fa-plus"></i> Add Record
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Animal</th>
                            <th>Event</th>
                            <th>Medication</th>
                            <th>Alert Level</th>
                            <th>Date</th>
                            <th>AI Diagnosis</th>
                        </tr>
                    </thead>
                    <tbody id="health-table-body">
                        <tr><td colspan="6" class="text-center py-8 text-[var(--text-secondary)] text-sm">
                            Loading health records...
                        </td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
}

export async function initHealthLogic() {
    let vaccines = [];
    let healthRecords = [];
    let animals = [];

    try {
        vaccines = await apiService.get('vaccines');
    } catch {
        vaccines = getLocal('fincapp_vaccines');
    }

    try {
        healthRecords = await apiService.get('health-records');
    } catch {
        healthRecords = getLocal('fincapp_health_records');
    }

    try {
        animals = await apiService.get('livestock');
    } catch {
        animals = getLocal('fincapp_livestock');
    }

    renderVaccineList(vaccines);
    renderHealthTable(healthRecords);
    checkAlerts(vaccines);

    // Add vaccine button
    document.getElementById('btn-add-vaccine')?.addEventListener('click', () => {
        openVaccineForm(animals, async (data) => {
            const result = await offlinePost('vaccines', data, 'fincapp_vaccines');
            vaccines.push({ ...data, id: Date.now() });
            renderVaccineList(vaccines);
            checkAlerts(vaccines);
            showToast('Vaccine scheduled!', 'success');
            speak(`Vaccine ${data.vaccine_name} scheduled for animal number ${data.animal_tag}`);
            closeGlobalModal();
        });
    });

    // Add health record
    document.getElementById('btn-add-health')?.addEventListener('click', () => {
        openHealthRecordForm(animals, async (data) => {
            const result = await offlinePost('health-records', data, 'fincapp_health_records');
            healthRecords.push({ ...data, id: Date.now() });
            renderHealthTable(healthRecords);
            showToast('Health record added', 'success');
            speak(`Health record added for animal number ${data.animal_id}`);
            closeGlobalModal();
        });
    });
}

function renderVaccineList(vaccines) {
    const container = document.getElementById('vaccine-list');
    if (!container) return;

    if (vaccines.length === 0) {
        container.innerHTML = `<div class="card text-center py-8 text-[var(--text-secondary)]">
            <i class="fas fa-syringe text-3xl mb-3 opacity-20"></i>
            <p class="text-sm">No vaccines scheduled yet.</p>
        </div>`;
        return;
    }

    const today = new Date();
    const sorted = [...vaccines].sort((a, b) => new Date(a.next_date) - new Date(b.next_date));

    container.innerHTML = sorted.map(v => {
        const daysLeft = Math.ceil((new Date(v.next_date) - today) / (1000 * 60 * 60 * 24));
        const isOverdue = daysLeft < 0;
        const isSoon = daysLeft >= 0 && daysLeft <= 7;
        const cardClass = isOverdue ? 'vaccine-card-overdue' : isSoon ? 'vaccine-card-soon' : 'vaccine-card-ok';
        const badgeClass = isOverdue ? 'badge-critical' : isSoon ? 'badge-warning' : 'badge-safe';
        const label = isOverdue
            ? `${Math.abs(daysLeft)} days overdue`
            : daysLeft === 0 ? 'Due today!'
            : `Due in ${daysLeft} days`;

        return `
        <div class="card p-4 ${cardClass} flex items-center justify-between gap-4 flex-wrap">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${isOverdue ? 'bg-red-100' : isSoon ? 'bg-amber-100' : 'bg-green-100'}">
                    <i class="fas fa-syringe ${isOverdue ? 'text-red-500' : isSoon ? 'text-amber-500' : 'text-green-500'}"></i>
                </div>
                <div>
                    <p class="font-bold text-sm">Animal #${v.animal_tag || v.animal_id} — ${v.vaccine_name || 'Vaccine'}</p>
                    <p class="text-xs text-[var(--text-secondary)]">
                        Next: ${new Date(v.next_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        ${v.notes ? ' · ' + v.notes : ''}
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="${badgeClass}">${label}</span>
                <button onclick="markVaccineDone(${v.id})" 
                    class="text-xs text-[var(--accent)] hover:underline font-bold">
                    Mark Done
                </button>
            </div>
        </div>`;
    }).join('');

    window.markVaccineDone = async (id) => {
        try {
            await apiService.put(`vaccines/${id}`, { status: 'done', done_date: new Date().toISOString() });
            const idx = vaccines.findIndex(v => v.id === id);
            if (idx >= 0) vaccines.splice(idx, 1);
            renderVaccineList(vaccines);
            checkAlerts(vaccines);
            showToast('Vaccine marked as done!', 'success');
            speak(`Vaccine marked as completed`);
        } catch (err) {
            showToast('Error marking vaccine: ' + err.message, 'error');
        }
    };
}

function renderHealthTable(records) {
    const tbody = document.getElementById('health-table-body');
    if (!tbody) return;

    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-[var(--text-secondary)] text-sm">
            No health records yet.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = records.map(r => {
        const alertClass = r.alert_level === 'high' ? 'badge-critical' : r.alert_level === 'medium' ? 'badge-warning' : 'badge-safe';
        const date = r.event_date ? new Date(r.event_date).toLocaleDateString('en-US') : '—';
        return `
        <tr>
            <td class="font-bold">#${r.animal_id}</td>
            <td>${r.event_type || '—'}</td>
            <td>${r.medication_name || '—'}</td>
            <td><span class="${alertClass}">${r.alert_level || 'low'}</span></td>
            <td class="text-[var(--text-secondary)]">${date}</td>
            <td>
                <button onclick="getAnimalDiagnosis(${r.animal_id})"
                    class="text-xs text-[var(--accent)] hover:underline font-medium flex items-center gap-1">
                    <i class="fas fa-robot"></i> Ask AI
                </button>
            </td>
        </tr>`;
    }).join('');

    window.getAnimalDiagnosis = async (animalId) => {
        showToast('Requesting AI diagnosis...', 'info');
        const diagnosis = await getAIDiagnosis({ id: animalId, weight: 350 });
        speak(diagnosis);
        openGlobalModal(`
            <div class="p-6">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <i class="fas fa-robot text-blue-500"></i>
                    </div>
                    <div>
                        <h3 class="font-bold">AI Veterinary Diagnosis</h3>
                        <p class="text-xs text-[var(--text-secondary)]">Animal #${animalId}</p>
                    </div>
                </div>
                <div class="p-4 bg-[var(--bg-main)] rounded-xl text-sm leading-relaxed">
                    ${diagnosis}
                </div>
                <button onclick="closeModal()" class="btn-primary w-full mt-4">Close</button>
            </div>
        `);
    };
}

function checkAlerts(vaccines) {
    const today = new Date();
    const overdue = vaccines.filter(v => new Date(v.next_date) < today).length;
    const banner = document.getElementById('alert-banner');
    const text = document.getElementById('alert-banner-text');

    if (overdue > 0 && banner && text) {
        banner.classList.remove('hidden');
        text.textContent = `${overdue} animal${overdue > 1 ? 's have' : ' has'} overdue vaccinations. Act now!`;
        speak(`Atención: ${overdue} animales tienen vacunas vencidas.`);
    }
}

function openVaccineForm(animals, onSubmit) {
    const animalOptions = animals.map(a =>
        `<option value="${a.tag_number || a.tag || a.id}">Animal #${a.tag_number || a.tag || a.id} (${a.breed || '—'})</option>`
    ).join('');

    openGlobalModal(`
        <div class="p-6">
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-lg font-bold">Schedule Vaccination</h3>
                <button onclick="closeModal()" class="text-[var(--text-secondary)] hover:text-red-500 text-xl">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="vaccine-form" class="space-y-4">
                <div>
                    <label class="form-label">Animal</label>
                    <select id="v-animal" class="form-input" required>
                        <option value="">Select animal...</option>
                        ${animalOptions}
                    </select>
                </div>
                <div>
                    <label class="form-label">Vaccine Name</label>
                    <input type="text" id="v-name" class="form-input" placeholder="e.g. FMD, Brucellosis, IBR" required>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Application Date</label>
                        <input type="date" id="v-date" class="form-input" required>
                    </div>
                    <div>
                        <label class="form-label">Next Due Date</label>
                        <input type="date" id="v-next" class="form-input" required>
                    </div>
                </div>
                <div>
                    <label class="form-label">Notes (optional)</label>
                    <input type="text" id="v-notes" class="form-input" placeholder="Dosage, lot number, etc.">
                </div>
                <div class="flex gap-3 pt-2">
                    <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancel</button>
                    <button type="submit" class="btn-primary flex-1">Schedule Vaccine</button>
                </div>
            </form>
        </div>
    `);

    document.getElementById('vaccine-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            animal_tag: document.getElementById('v-animal').value,
            animal_id: document.getElementById('v-animal').value,
            vaccine_name: document.getElementById('v-name').value,
            application_date: document.getElementById('v-date').value,
            next_date: document.getElementById('v-next').value,
            notes: document.getElementById('v-notes').value,
        };
        await onSubmit(data);
    });
}

function openHealthRecordForm(animals, onSubmit) {
    const animalOptions = animals.map(a =>
        `<option value="${a.id || a.tag_number}">Animal #${a.tag_number || a.id}</option>`
    ).join('');

    openGlobalModal(`
        <div class="p-6">
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-lg font-bold">Add Health Record</h3>
                <button onclick="closeModal()" class="text-[var(--text-secondary)] hover:text-red-500 text-xl">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="health-form" class="space-y-4">
                <div>
                    <label class="form-label">Animal</label>
                    <select id="h-animal" class="form-input" required>
                        <option value="">Select animal...</option>
                        ${animalOptions}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Event Type</label>
                        <select id="h-type" class="form-input">
                            <option>Illness</option>
                            <option>Injury</option>
                            <option>Treatment</option>
                            <option>Checkup</option>
                            <option>Surgery</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Alert Level</label>
                        <select id="h-level" class="form-input">
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="form-label">Medication / Treatment</label>
                    <input type="text" id="h-medication" class="form-input" placeholder="e.g. Ivermectin 1%">
                </div>
                <div class="flex gap-3 pt-2">
                    <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancel</button>
                    <button type="submit" class="btn-primary flex-1">Save Record</button>
                </div>
            </form>
        </div>
    `);

    document.getElementById('health-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            animal_id: document.getElementById('h-animal').value,
            event_type: document.getElementById('h-type').value,
            alert_level: document.getElementById('h-level').value,
            medication_name: document.getElementById('h-medication').value,
            event_date: new Date().toISOString(),
        };
        await onSubmit(data);
    });
}
