export async function getTables() {
  const res = await fetch('/api/tables');
  if (!res.ok) throw new Error('Failed to fetch tables');
  return res.json();
}

export async function createTable(name: string) {
  const res = await fetch('/api/tables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create table');
  }
  return res.json();
}

export async function deleteTable(id: string) {
  const res = await fetch(`/api/tables/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete table');
  }
  return res.json();
}

export async function cancelTableOrder(id: string) {
  const res = await fetch(`/api/tables/${id}/cancel`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to cancel table order');
  }
  return res.json();
}

export async function saveTableOrder(id: string, items: any[]) {
  const res = await fetch(`/api/tables/${id}/save`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to save table order');
  }
  return res.json();
}

export async function checkoutTable(id: string, payments: any[]) {
  const res = await fetch(`/api/tables/${id}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payments })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to checkout table');
  }
  return res.json();
}

export async function openTable(id: string, userId?: string) {
  const res = await fetch(`/api/tables/${id}/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to open table');
  }
  return res.json();
}

export async function mergeTables(sourceTableId: string, targetTableId: string) {
  const res = await fetch(`/api/tables/${sourceTableId}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetTableId })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al fusionar las mesas');
  }
  return res.json();
}

export async function transferTableItems(sourceTableId: string, targetTableId: string, items: Array<{ productId: string; quantity: number }>) {
  const res = await fetch(`/api/tables/${sourceTableId}/transfer-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetTableId, items })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al transferir productos');
  }
  return res.json();
}

export async function partialCheckoutTable(tableId: string, payload: { userId: string; items: any[]; payments: any[] }) {
  const res = await fetch(`/api/tables/${tableId}/partial-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al procesar el cobro parcial');
  }
  return res.json();
}

