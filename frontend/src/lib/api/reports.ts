export async function getDashboardData(start?: string, end?: string) {
  const params = new URLSearchParams();
  if (start) params.append('start', start);
  if (end) params.append('end', end);
  const query = params.toString();
  const url = query ? `/api/reports/dashboard?${query}` : '/api/reports/dashboard';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch dashboard data');
  return res.json();
}

export async function getInventoryAlerts() {
  const res = await fetch('/api/reports/inventory-alerts');
  if (!res.ok) throw new Error('Failed to fetch inventory alerts');
  return res.json();
}
