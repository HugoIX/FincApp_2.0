/**
 * app.js - FincApp Main Entry Point
 * Bootstraps authentication state and initializes the SPA router.
 */

import { initAuth, getCurrentUser, logout as authLogout } from './auth.js';
import { initRouter, navigateTo } from './router.js';
import { initVoiceAssistant, toggleVoice, speak } from './voice-logic.js';
import { updateOnlineStatus, startOfflineSync } from './api.js';
import { showToast } from './ui-utils.js';
import { loadTheme, toggleTheme } from './settings.js';

// ===== EXPOSE GLOBALS for inline onclick handlers =====
window.navigateTo = navigateTo;
window.toggleVoice = toggleVoice;
window.toggleTheme = toggleTheme;
window.logout = () => {
    speak(`Session closed. See you later`);
    authLogout();
    showAuthScreen();
};
window.closeModal = closeGlobalModal;
window.openGlobalModal = openGlobalModal;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    loadTheme();
    updateOnlineStatus();

    window.addEventListener('online', () => {
        updateOnlineStatus();
        startOfflineSync();
    });
    window.addEventListener('offline', updateOnlineStatus);

    // Check if user is already logged in
    const user = getCurrentUser();
    if (user) {
        showAppShell(user);
    } else {
        showAuthScreen();
    }

    // Mobile sidebar toggle
    document.getElementById('menu-toggle')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('open');
    });

    // Click outside sidebar to close on mobile
    document.getElementById('main-wrapper')?.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar?.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    });
});

// ===== SHOW AUTH SCREEN =====
export function showAuthScreen() {
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('voice-fab').classList.add('hidden');
    initAuth(onLoginSuccess);
}

// ===== SHOW APP AFTER LOGIN =====
function onLoginSuccess(user) {
    showAppShell(user);
}

function showAppShell(user) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    document.getElementById('voice-fab').classList.remove('hidden');

    // Set user info in sidebar
    document.getElementById('user-name-sidebar').textContent = user.full_name || user.email;
    document.getElementById('user-role-sidebar').textContent = user.role || 'farmer';
    document.getElementById('user-avatar').textContent = (user.full_name || user.email)[0].toUpperCase();

    // Show admin section if admin
    if (user.role === 'admin') {
        document.getElementById('admin-section')?.classList.remove('hidden');
    }

    // Init voice assistant
    initVoiceAssistant();

    // Init router and go to dashboard
    initRouter();
    navigateTo('dashboard');
}

// ===== GLOBAL MODAL =====
export function openGlobalModal(htmlContent) {
    const modal = document.getElementById('global-modal');
    const wrapper = document.getElementById('modal-content-wrapper');
    wrapper.innerHTML = htmlContent;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    // Close on backdrop click
    modal.onclick = (e) => { if (e.target === modal) closeGlobalModal(); };
}

export function closeGlobalModal() {
    const modal = document.getElementById('global-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}
