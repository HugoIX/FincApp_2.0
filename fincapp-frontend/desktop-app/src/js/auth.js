/**
 * auth.js - FincApp Authentication Module
 * Handles login, registration, role-based access control (RBAC),
 * and session persistence via localStorage.
 */

import { apiService } from './api.js';
import { showToast } from './ui-utils.js';
import { speak } from './voice-logic.js';

const SESSION_KEY = 'fincapp_session';
let onLoginCallback = null;

// ===== SESSION MANAGEMENT =====
export function getCurrentUser() {
    try {
        const session = localStorage.getItem(SESSION_KEY);
        return session ? JSON.parse(session) : null;
    } catch { return null; }
}

export function setCurrentUser(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function logout() {
    localStorage.removeItem(SESSION_KEY);
    showToast('Logged out successfully', 'info');
}

// ===== ROLE HELPERS =====
export function isAdmin() {
    return getCurrentUser()?.role === 'admin';
}

export function getUserId() {
    return getCurrentUser()?.id;
}

export function requireRole(role) {
    const user = getCurrentUser();
    if (!user || user.role !== role) {
        navigateTo('dashboard');
        showToast('Access denied: insufficient permissions', 'error');
        return false;
    }
    return true;
}

// ===== AUTH UI =====
export function initAuth(onSuccess) {
    onLoginCallback = onSuccess;
    renderLoginForm();
}

function renderLoginForm() {
    const container = document.getElementById('auth-screen');
    container.innerHTML = `
        <div class="auth-card">
            <!-- Logo -->
            <div class="text-center mb-8">
                <div class="w-14 h-14 bg-[var(--accent)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/20">
                    <i class="fas fa-leaf text-white text-xl"></i>
                </div>
                <h1 class="text-3xl font-bold font-display text-[var(--text-primary)]">FincApp</h1>
                <p class="text-[var(--text-secondary)] text-sm mt-1">Smart Livestock Management</p>
            </div>

            <!-- Tabs -->
            <div class="flex bg-[var(--bg-main)] rounded-xl p-1 mb-6">
                <button id="tab-login" onclick="switchAuthTab('login')" 
                    class="flex-1 py-2 rounded-lg text-sm font-bold transition-all bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm">
                    Sign In
                </button>
                <button id="tab-register" onclick="switchAuthTab('register')" 
                    class="flex-1 py-2 rounded-lg text-sm font-bold transition-all text-[var(--text-secondary)]">
                    Register
                </button>
            </div>

            <!-- Login Form -->
            <div id="login-form-section">
                <form id="login-form" class="space-y-4">
                    <div>
                        <label class="form-label">Email</label>
                        <input type="email" id="login-email" class="form-input" placeholder="you@farm.com" required>
                    </div>
                    <div>
                        <label class="form-label">Password</label>
                        <input type="password" id="login-password" class="form-input" placeholder="••••••••" required>
                    </div>
                    <button type="submit" id="btn-login" class="btn-primary w-full mt-2">
                        <i class="fas fa-right-to-bracket mr-2"></i> Sign In
                    </button>
                </form>
                <p class="text-center text-[var(--text-secondary)] text-xs mt-4">
                    Demo: admin@farm.com / admin123
                </p>
            </div>

            <!-- Register Form -->
            <div id="register-form-section" class="hidden">
                <form id="register-form" class="space-y-4">
                    <div>
                        <label class="form-label">Full Name</label>
                        <input type="text" id="reg-name" class="form-input" placeholder="Juan Pérez" required>
                    </div>
                    <div>
                        <label class="form-label">Email</label>
                        <input type="email" id="reg-email" class="form-input" placeholder="you@farm.com" required>
                    </div>
                    <div>
                        <label class="form-label">Farm Name</label>
                        <input type="text" id="reg-farm" class="form-input" placeholder="Finca El Progreso">
                    </div>
                    <div>
                        <label class="form-label">Phone</label>
                        <input type="tel" id="reg-phone" class="form-input" placeholder="+57 300 000 0000">
                    </div>
                    <div>
                        <label class="form-label">Password</label>
                        <input type="password" id="reg-password" class="form-input" placeholder="Min 6 characters" required minlength="6">
                    </div>
                    <button type="submit" id="btn-register" class="btn-primary w-full mt-2">
                        <i class="fas fa-user-plus mr-2"></i> Create Account
                    </button>
                </form>
            </div>
        </div>
    `;

    // Expose tab switcher globally
    window.switchAuthTab = (tab) => {
        const isLogin = tab === 'login';
        document.getElementById('login-form-section').classList.toggle('hidden', !isLogin);
        document.getElementById('register-form-section').classList.toggle('hidden', isLogin);
        document.getElementById('tab-login').className = isLogin
            ? 'flex-1 py-2 rounded-lg text-sm font-bold transition-all bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
            : 'flex-1 py-2 rounded-lg text-sm font-bold transition-all text-[var(--text-secondary)]';
        document.getElementById('tab-register').className = !isLogin
            ? 'flex-1 py-2 rounded-lg text-sm font-bold transition-all bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
            : 'flex-1 py-2 rounded-lg text-sm font-bold transition-all text-[var(--text-secondary)]';
    };

    // Login submit
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-login');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner animate-spin mr-2"></i> Signing in...';

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const result = await loginUser(email, password);

        if (result.success) {
            showToast(`Welcome back, ${result.user.full_name || result.user.email}!`, 'success');
            speak(`Welcome ${result.user.full_name || 'to the system'}`);
            onLoginCallback?.(result.user);
        } else {
            showToast(result.message || 'Login failed', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-right-to-bracket mr-2"></i> Sign In';
        }
    });

    // Register submit
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-register');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner animate-spin mr-2"></i> Creating account...';

        const userData = {
            full_name: document.getElementById('reg-name').value,
            email: document.getElementById('reg-email').value,
            farm_name: document.getElementById('reg-farm').value,
            phone: document.getElementById('reg-phone').value,
            password: document.getElementById('reg-password').value,
            role: 'farmer'
        };

        const result = await registerUser(userData);

        if (result.success) {
            showToast('Account created! Please sign in.', 'success');
            speak(`Account successfully created. Please log in`);
            window.switchAuthTab('login');
        } else {
            showToast(result.message || 'Registration failed', 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus mr-2"></i> Create Account';
    });
}

// ===== AUTH API CALLS =====
async function loginUser(email, password) {
    try {
        const result = await apiService.post('auth/login', { email, password });
        if (result.token && result.user) {
            setCurrentUser({ ...result.user, token: result.token });
            return { success: true, user: result.user };
        }
        return { success: false, message: result.message || 'Invalid credentials' };
    } catch (err) {
        // OFFLINE FALLBACK: Demo accounts for testing
        const demoUsers = [
            { id: 1, email: 'admin@farm.com', password: 'admin123', full_name: 'Admin User', role: 'admin', farm_name: 'Demo Farm' },
            { id: 2, email: 'worker@farm.com', password: 'worker123', full_name: 'Farm Worker', role: 'farmer', farm_name: 'Demo Farm' },
        ];
        const user = demoUsers.find(u => u.email === email && u.password === password);
        if (user) {
            const { password: _, ...safeUser } = user;
            setCurrentUser({ ...safeUser, token: 'demo-token' });
            return { success: true, user: safeUser };
        }
        return { success: false, message: 'Invalid email or password' };
    }
}

async function registerUser(userData) {
    try {
        const result = await apiService.post('auth/register', userData);
        return result.success
            ? { success: true }
            : { success: false, message: result.message };
    } catch (err) {
        // Offline: save to local pending
        const pending = JSON.parse(localStorage.getItem('fincapp_pending_users') || '[]');
        pending.push({ ...userData, pending: true, created_at: new Date().toISOString() });
        localStorage.setItem('fincapp_pending_users', JSON.stringify(pending));
        return { success: true }; // Will sync when online
    }
}
