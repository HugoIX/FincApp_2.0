/**
 * calculations.js - Core Business Logic
 * ADG (Average Daily Gain) and Health Traffic Light calculations.
 */

export function calculateGDP(currentWeight, previousWeight, lastDate, currentDate) {
    const start = new Date(lastDate);
    const end = new Date(currentDate);
    const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));

    if (days <= 0) return { gdp: 0, days: 0, performance: 'invalid' };

    const gdp = parseFloat(((currentWeight - previousWeight) / days).toFixed(2));

    let performance = 'stable';
    if (gdp > 0.8) performance = 'excellent';
    else if (gdp > 0.4) performance = 'stable';
    else if (gdp >= 0) performance = 'poor';
    else performance = 'critical';

    return { gdp, days, performance };
}

export function getHealthStatus(dueDateStr) {
    const today = new Date();
    const due = new Date(dueDateStr);
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'critical';
    if (diffDays <= 7) return 'warning';
    return 'safe';
}
