// src/utils/formatters.ts

export function formatCurrency(amount: number): string {
  if (isNaN(amount)) return 'Rs. 0';
  if (amount >= 100000) return 'Rs. ' + (amount / 100000).toFixed(2) + 'L';
  if (amount >= 1000) return 'Rs. ' + (amount / 1000).toFixed(1) + 'K';
  return 'Rs. ' + amount.toFixed(0);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 2) return 'just now';
  if (h < 1) return m + 'm ago';
  if (d < 1) return h + 'h ago';
  return d + 'd ago';
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

export function getGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning, ' + name;
  if (hour < 17) return 'Good afternoon, ' + name;
  return 'Good evening, ' + name;
}

// parseFlexibleDate — Bug B fix. Handles ISO, DD/MM/YYYY (Indian), and epoch.
// Use this everywhere instead of new Date(raw).
export function parseFlexibleDate(raw: any): Date | null {
  if (!raw) return null;
  // DD/MM/YYYY — Indian format
  if (typeof raw === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('/').map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  // D/M/YYYY variant
  if (typeof raw === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('/').map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  // epoch number
  if (typeof raw === 'number') return new Date(raw);
  // ISO / anything else
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
