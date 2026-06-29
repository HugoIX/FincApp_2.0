/**
 * router.js - FincApp SPA Router
 * Manages view rendering and navigation state.
 * All views are lazy-loaded modules for performance.
 */

import { showToast } from './ui-utils.js';

const PAGE_TITLES = {
    dashboard:  'Dashboard',
    inventory:  'Livestock Inventory',
    health:     'Health & Vaccines',
    activities: 'Farm Activities',
    weights:    'Weight Control',
    reports:    'Reports & Exports',
    settings:   'Settings',
    admin:      'Admin Panel',
};

// Registry of view render functions (lazy imports)
const VIEW_LOADERS = {
    dashboard:  () => import('./views/dashboard.js').then(m => m.renderDashboard),
    inventory:  () => import('./views/inventory.js').then(m => m.renderInventory),
    health:     () => import('./views/health.js').then(m => m.renderHealth),
    activities: () => import('./views/activities.js').then(m => m.renderActivities),
    weights:    () => import('./views/weights.js').then(m => m.renderWeights),
    reports:    () => import('./views/reports.js').then(m => m.renderReports),
    settings:   () => import('./views/settings.js').then(m => m.renderSettings),
    admin:      () => import('./views/admin.js').then(m => m.renderAdmin),
};

let currentView = null;

export async function navigateTo(viewKey) {
    if (!VIEW_LOADERS[viewKey]) {
        console.warn(`[Router] Unknown view: ${viewKey}`);
        return;
    }

    const container = document.getElementById('app-content');
    if (!container) return;

    // Show loading state
    container.innerHTML = `
        <div class="flex items-center justify-center h-64 text-[var(--text-secondary)]">
            <i class="fas fa-spinner animate-spin text-2xl mr-3"></i>
            <span class="font-medium">Loading...</span>
        </div>
    `;

    try {
        const renderFn = await VIEW_LOADERS[viewKey]();
        const html = await renderFn();
        container.innerHTML = `<div class="page-enter">${html}</div>`;

        // Update page title
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = PAGE_TITLES[viewKey] || viewKey;

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewKey);
        });

        // Execute view's post-render logic
        await initViewLogic(viewKey);
        currentView = viewKey;

        // Push to browser history
        history.pushState({ view: viewKey }, '', `#${viewKey}`);

    } catch (err) {
        console.error(`[Router] Failed to load view: ${viewKey}`, err);
        container.innerHTML = `
            <div class="card text-center py-20">
                <i class="fas fa-triangle-exclamation text-4xl text-[var(--warning)] mb-4"></i>
                <p class="font-bold text-lg mb-2">Failed to load this section</p>
                <p class="text-[var(--text-secondary)] text-sm mb-6">${err.message}</p>
                <button onclick="navigateTo('dashboard')" class="btn-primary">Back to Dashboard</button>
            </div>
        `;
        showToast('Failed to load view', 'error');
    }
}

/**
 * Runs post-render logic for each view (event listeners, data fetch, charts)
 */
async function initViewLogic(viewKey) {
    try {
        switch (viewKey) {
            case 'dashboard': {
                const { initDashboardLogic } = await import('./views/dashboard.js');
                await initDashboardLogic();
                break;
            }
            case 'inventory': {
                const { initInventoryLogic } = await import('./views/inventory.js');
                await initInventoryLogic();
                break;
            }
            case 'health': {
                const { initHealthLogic } = await import('./views/health.js');
                await initHealthLogic();
                break;
            }
            case 'activities': {
                const { initActivitiesLogic } = await import('./views/activities.js');
                await initActivitiesLogic();
                break;
            }
            case 'weights': {
                const { initWeightsLogic } = await import('./views/weights.js');
                await initWeightsLogic();
                break;
            }
            case 'reports': {
                const { initReportsLogic } = await import('./views/reports.js');
                await initReportsLogic();
                break;
            }
            case 'settings': {
                const { initSettingsLogic } = await import('./views/settings.js');
                await initSettingsLogic();
                break;
            }
            case 'admin': {
                const { initAdminLogic } = await import('./views/admin.js');
                await initAdminLogic();
                break;
            }
        }
    } catch (err) {
        console.warn(`[Router] initViewLogic error for ${viewKey}:`, err);
    }
}

export function initRouter() {
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
        const view = e.state?.view || 'dashboard';
        navigateTo(view);
    });

    // Handle hash navigation (e.g. deep links)
    const hash = window.location.hash.replace('#', '');
    if (hash && VIEW_LOADERS[hash]) {
        navigateTo(hash);
    }
}

export function getCurrentView() { return currentView; }
