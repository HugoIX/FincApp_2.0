/**
 * api.js - FincApp 2.0 Centralized API Service
 * Supports the legacy Node backend, old frontend endpoint names, and offline-first fallback.
 */

const BASE_URL = localStorage.getItem('fincapp_api_base_url') || 'https://fincapp.crudzaso.com/api/v1';
const PYTHON_URL = localStorage.getItem('fincapp_ai_base_url') || '';
const OFFLINE_QUEUE_KEY = 'fincapp_offline_queue';

const ENDPOINT_ALIASES = {
    livestock: 'animals',
    activities: 'farm-events',
    users: 'user'
};

function normalizeEndpoint(endpoint = '') {
    const clean = String(endpoint).replace(/^\/+/, '');
    const [path, query = ''] = clean.split('?');
    const parts = path.split('/').filter(Boolean);
    const first = parts[0];
    const mappedFirst = ENDPOINT_ALIASES[first] || first;
    const normalized = [mappedFirst, ...parts.slice(1)].join('/');
    return query ? `${normalized}?${query}` : normalized;
}

function buildUrl(endpoint) {
    return `${BASE_URL}/${normalizeEndpoint(endpoint)}`;
}

async function parseResponse(response, endpoint) {
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }

    if (!response.ok) {
        const message = payload?.message || `${endpoint} failed: ${response.status}`;
        throw new Error(message);
    }

    return payload;
}

export const apiService = {
    async get(endpoint) {
        const response = await fetch(buildUrl(endpoint), {
            headers: authHeaders()
        });
        return parseResponse(response, `GET ${endpoint}`);
    },

    async post(endpoint, data) {
        const response = await fetch(buildUrl(endpoint), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(data)
        });
        return parseResponse(response, `POST ${endpoint}`);
    },

    async put(endpoint, data) {
        const response = await fetch(buildUrl(endpoint), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(data)
        });
        return parseResponse(response, `PUT ${endpoint}`);
    },

    async delete(endpoint) {
        const response = await fetch(buildUrl(endpoint), {
            method: 'DELETE',
            headers: authHeaders()
        });
        return parseResponse(response, `DELETE ${endpoint}`);
    }
};

export async function offlinePost(endpoint, data, localKey = null) {
    const normalized = normalizeEndpoint(endpoint);

    if (!navigator.onLine) {
        queueForSync(normalized, 'POST', data);
        if (localKey) saveLocal(localKey, data);
        return { status: 'queued', offline: true, data };
    }

    try {
        return await apiService.post(normalized, data);
    } catch (err) {
        console.warn('[Offline] POST queued:', err.message);
        queueForSync(normalized, 'POST', data);
        if (localKey) saveLocal(localKey, data);
        return { status: 'queued', offline: true, data };
    }
}

export function saveLocal(key, data) {
    try {
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.push({
            ...data,
            id: data.id || Date.now(),
            _id: Date.now(),
            _created: new Date().toISOString(),
            sync_status: data.sync_status || 'pending'
        });
        localStorage.setItem(key, JSON.stringify(existing));
    } catch (e) {
        console.warn('LocalStorage save failed:', e);
    }
}

export function getLocal(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
        return [];
    }
}

export function updateLocal(key, id, updates) {
    const items = getLocal(key);
    const idx = items.findIndex(i => i.id === id || i._id === id || i.tag_number === id || i.tag === id);
    if (idx >= 0) {
        items[idx] = { ...items[idx], ...updates };
        localStorage.setItem(key, JSON.stringify(items));
    }
}

export function deleteLocal(key, id) {
    const items = getLocal(key).filter(i => i.id !== id && i._id !== id && i.tag_number !== id && i.tag !== id);
    localStorage.setItem(key, JSON.stringify(items));
}

function queueForSync(endpoint, method, data) {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    queue.push({ endpoint: normalizeEndpoint(endpoint), method, data, timestamp: new Date().toISOString() });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    updateOfflineBadge();
}

export async function startOfflineSync() {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (queue.length === 0) return { synced: 0, pending: 0 };

    let synced = 0;
    const failed = [];

    for (const item of queue) {
        try {
            if (item.method === 'POST') await apiService.post(item.endpoint, item.data);
            else if (item.method === 'PUT') await apiService.put(item.endpoint, item.data);
            synced++;
        } catch (err) {
            failed.push(item);
        }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failed));
    updateOfflineBadge();

    if (synced > 0) {
        const { showToast } = await import('./ui-utils.js');
        showToast(`Synced ${synced} pending record${synced > 1 ? 's' : ''}`, 'success');
    }

    return { synced, pending: failed.length };
}

export function getPendingCount() {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]').length;
}

function updateOfflineBadge() {
    const count = getPendingCount();
    const badge = document.getElementById('offline-badge');
    const countEl = document.getElementById('offline-count');
    if (badge && countEl) {
        countEl.textContent = count;
        badge.classList.toggle('hidden', count === 0);
        badge.classList.toggle('flex', count > 0);
    }
}

export async function saveToPython(data) {
    try {
        const res = await fetch(`${PYTHON_URL}/livestock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`Python backend error: ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn('[Python] Helper unavailable, using local cache only.');
        saveLocal('fincapp_livestock', data);
        return { status: 'queued', offline: true };
    }
}

export async function fetchFromPython() {
    try {
        const res = await fetch(`${PYTHON_URL}/livestock`);
        if (!res.ok) throw new Error();
        return await res.json();
    } catch {
        return [];
    }
}

export async function getDashboardSummary(farmId = 'all') {
    try {
        return await apiService.get(`dashboard/summary?farm_id=${encodeURIComponent(farmId)}`);
    } catch (err) {
        return buildLocalDashboardSummary(farmId);
    }
}

export async function getDashboardFarms() {
    try {
        return await apiService.get('dashboard/farms');
    } catch {
        const farms = getLocal('fincapp_farms');
        if (farms.length > 0) return [{ id: 'all', name: 'All farms' }, ...farms];
        return getDemoFarms();
    }
}

export function updateOnlineStatus() {
    const status = document.getElementById('sync-status');
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    if (!status || !dot || !text) return;

    if (navigator.onLine) {
        status.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold';
        dot.className = 'w-2 h-2 rounded-full bg-green-500 animate-pulse';
        text.textContent = 'ONLINE';
    } else {
        status.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold';
        dot.className = 'w-2 h-2 rounded-full bg-amber-500';
        text.textContent = 'OFFLINE';
    }

    updateOfflineBadge();
}

function authHeaders() {
    const session = JSON.parse(localStorage.getItem('fincapp_session') || '{}');
    return session.token ? { 'Authorization': `Bearer ${session.token}` } : {};
}

export function getDemoFarms() {
    return [
        { id: 'all', name: 'All farms' },
        { id: 'Oak Farm', name: 'Oak Farm' },
        { id: 'Hope Farm', name: 'Hope Farm' },
        { id: 'empty', name: 'Empty State Demo' }
    ];
}

function demoDataset() {
    return {
        all: {
            farm_id: 'all',
            total_animals: 12,
            animals_by_type: [
                { animal_type: 'cattle', total: 7 },
                { animal_type: 'swine', total: 3 },
                { animal_type: 'poultry', total: 2 }
            ],
            average_weight: 318.4,
            health_alerts_count: 3,
            pending_sync: getPendingCount(),
            weight_trend: [
                { label: 'Mon', value: 290 }, { label: 'Tue', value: 301 },
                { label: 'Wed', value: 312 }, { label: 'Thu', value: 318 },
                { label: 'Fri', value: 326 }, { label: 'Sat', value: 332 },
                { label: 'Sun', value: 338 }
            ],
            health_alerts: [
                { id: 1, tag_number: '302', severity: 'high', description: 'Fever detected by AURA', event_date: new Date().toISOString() },
                { id: 2, tag_number: '12', severity: 'high', description: 'Loss of appetite reported', event_date: new Date().toISOString() },
                { id: 3, tag_number: 'G15', severity: 'medium', description: 'Cough observation', event_date: new Date().toISOString() }
            ],
            recent_activity: [
                { id: 1, event_type: 'Sync', description: 'Offline records synchronized from Android APK', created_at: new Date().toISOString(), tag_number: '302' },
                { id: 2, event_type: 'Weight', description: 'Cattle 302 registered at 520 kg', created_at: new Date().toISOString(), tag_number: '302' },
                { id: 3, event_type: 'Health', description: 'Fever alert created by AURA', created_at: new Date().toISOString(), tag_number: '302' }
            ],
            empty: false,
            last_sync: new Date().toISOString()
        },
        'Oak Farm': {
            farm_id: 'Oak Farm', total_animals: 7,
            animals_by_type: [{ animal_type: 'cattle', total: 4 }, { animal_type: 'swine', total: 2 }, { animal_type: 'poultry', total: 1 }],
            average_weight: 248.7, health_alerts_count: 2, pending_sync: getPendingCount(),
            weight_trend: [{label:'Mon',value:210},{label:'Tue',value:218},{label:'Wed',value:225},{label:'Thu',value:234},{label:'Fri',value:242},{label:'Sat',value:249},{label:'Sun',value:255}],
            health_alerts: [
                { id: 1, tag_number: '302', severity: 'high', description: 'Fever detected by AURA', event_date: new Date().toISOString() },
                { id: 2, tag_number: '12', severity: 'high', description: 'Loss of appetite reported', event_date: new Date().toISOString() }
            ],
            recent_activity: [
                { id: 1, event_type: 'Animal', description: 'Cattle 302 registered locally', created_at: new Date().toISOString(), tag_number: '302' },
                { id: 2, event_type: 'Weight', description: 'Cattle 302 registered at 520 kg', created_at: new Date().toISOString(), tag_number: '302' }
            ],
            empty: false,
            last_sync: new Date().toISOString()
        },
        'Hope Farm': {
            farm_id: 'Hope Farm', total_animals: 5,
            animals_by_type: [{ animal_type: 'cattle', total: 3 }, { animal_type: 'swine', total: 1 }, { animal_type: 'poultry', total: 1 }],
            average_weight: 386.1, health_alerts_count: 1, pending_sync: 0,
            weight_trend: [{label:'Mon',value:350},{label:'Tue',value:358},{label:'Wed',value:365},{label:'Thu',value:372},{label:'Fri',value:380},{label:'Sat',value:390},{label:'Sun',value:398}],
            health_alerts: [{ id: 3, tag_number: '701', severity: 'medium', description: 'Mobility issue detected', event_date: new Date().toISOString() }],
            recent_activity: [{ id: 3, event_type: 'Sync', description: 'All local records synchronized', created_at: new Date().toISOString(), tag_number: '701' }],
            empty: false,
            last_sync: new Date().toISOString()
        },
        empty: {
            farm_id: 'empty', total_animals: 0, animals_by_type: [], average_weight: 0,
            health_alerts_count: 0, pending_sync: 0, weight_trend: [], health_alerts: [], recent_activity: [], empty: true, last_sync: null
        }
    };
}

function buildLocalDashboardSummary(farmId = 'all') {
    const queued = getPendingCount();
    const animals = getLocal('fincapp_livestock');
    const weights = getLocal('fincapp_weights');
    const health = getLocal('fincapp_health_records');
    const activities = getLocal('fincapp_activities');

    if (animals.length === 0 && weights.length === 0 && health.length === 0 && activities.length === 0) {
        const demos = demoDataset();
        return demos[farmId] || demos.all;
    }

    const typeCounts = animals.reduce((acc, animal) => {
        const raw = String(animal.animal_type || animal.type || animal.breed || 'cattle').toLowerCase();
        const type = raw.includes('cerdo') || raw.includes('swine') || raw.includes('porc') ? 'swine'
            : raw.includes('pollo') || raw.includes('gallina') || raw.includes('poultry') || raw.includes('ave') ? 'poultry'
            : 'cattle';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});

    const weightValues = weights.map(w => Number(w.current_weight || w.weight || w.weight_kg)).filter(Boolean);
    const average = weightValues.length ? weightValues.reduce((a, b) => a + b, 0) / weightValues.length : 0;
    const alerts = health.filter(h => ['high', 'medium'].includes(String(h.alert_level || h.severity).toLowerCase()));

    return {
        farm_id: farmId,
        total_animals: animals.length,
        animals_by_type: Object.entries(typeCounts).map(([animal_type, total]) => ({ animal_type, total })),
        average_weight: Number(average.toFixed(2)),
        health_alerts_count: alerts.length,
        pending_sync: queued,
        weight_trend: weights.slice(-7).map((w, idx) => ({ label: w.weighing_date || `Log ${idx + 1}`, value: Number(w.current_weight || w.weight || w.weight_kg || 0) })),
        health_alerts: alerts.slice(0, 8),
        recent_activity: activities.slice(-8).reverse(),
        empty: false,
        last_sync: new Date().toISOString()
    };
}
