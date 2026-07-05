export async function getTransfers() {
  const res = await fetch('/api/transfers');
  if (!res.ok) throw new Error('Failed to fetch transfers');
  return res.json();
}

export async function createTransfer(transferData: any) {
  const res = await fetch('/api/transfers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transferData)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create transfer');
  }
  return res.json();
}
