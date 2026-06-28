/**
 * settings.js - Theme management only
 * The full settings view is in views/settings.js
 */

export function loadTheme() {
    const saved = localStorage.getItem('fincapp_theme') || 'light';
    applyTheme(saved);
}

export function toggleTheme() {
    const current = localStorage.getItem('fincapp_theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('fincapp_theme', next);
}

function applyTheme(theme) {
    const html = document.documentElement;
    const icon = document.getElementById('theme-icon');
    if (theme === 'dark') {
        html.classList.add('dark');
        if (icon) icon.classList.replace('fa-moon', 'fa-sun');
    } else {
        html.classList.remove('dark');
        if (icon) icon.classList.replace('fa-sun', 'fa-moon');
    }
}