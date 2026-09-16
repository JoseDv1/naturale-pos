export interface SalesFilterParams {
  q?: string;
  status?: string;
  paymentMethod?: string;
  start?: string;
  end?: string;
}

export async function getSales(params?: SalesFilterParams) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.status && params.status !== 'ALL') query.set('status', params.status);
  if (params?.paymentMethod && params.paymentMethod !== 'ALL') query.set('paymentMethod', params.paymentMethod);
  if (params?.start) query.set('start', params.start);
  if (params?.end) query.set('end', params.end);

  const qs = query.toString();
  const url = qs ? `/api/sales?${qs}` : '/api/sales';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch sales history');
  return res.json();
}

export async function getSale(id: string) {
  const res = await fetch(`/api/sales/${id}`);
  if (!res.ok) throw new Error('Failed to fetch sale detail');
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
