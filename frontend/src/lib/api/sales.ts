export async function getSales() {
  const res = await fetch('/api/sales');
  if (!res.ok) throw new Error('Failed to fetch sales history');
  return res.json();
}

export async function createSale(saleData: any) {
  const res = await fetch('/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saleData)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create sale');
  }
  return res.json();
}

export async function cancelSale(id: string) {
  const res = await fetch(`/api/sales/${id}/cancel`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to cancel sale');
  }
  return res.json();
}
