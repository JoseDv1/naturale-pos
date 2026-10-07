export interface OpenShiftPayload {
  initialCash: number;
  notes?: string;
}

export interface CloseShiftPayload {
  actualCash: number;
  notes?: string;
}

export async function getCurrentShift() {
  const res = await fetch('/api/shifts/current');
  if (!res.ok) {
    throw new Error('Error al obtener el turno de caja actual');
  }
  return res.json();
}

export async function openShift(initialCash: number, notes?: string) {
  const res = await fetch('/api/shifts/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initialCash, notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || 'Error al abrir el turno de caja');
  }
  return res.json();
}

export async function closeShift(actualCash: number, notes?: string) {
  const res = await fetch('/api/shifts/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actualCash, notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || 'Error al cerrar el turno de caja');
  }
  return res.json();
}

export async function getShifts(start?: string, end?: string, shiftId?: string) {
  const params = new URLSearchParams();
  if (start) params.append('start', start);
  if (end) params.append('end', end);
  if (shiftId) params.append('shiftId', shiftId);
  const query = params.toString();
  const url = query ? `/api/shifts?${query}` : '/api/shifts';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Error al consultar los turnos');
  }
  return res.json();
}

export async function getShift(id: string) {
  const res = await fetch(`/api/shifts/${id}`);
  if (!res.ok) {
    throw new Error('Error al consultar el detalle del turno');
  }
  return res.json();
}
