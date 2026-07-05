export async function me() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) throw new Error('Failed to fetch current user');
  return res.json();
}

export async function logout() {
  const res = await fetch('/api/auth/logout', { method: 'POST' });
  if (!res.ok) throw new Error('Logout failed');
  return res.json();
}

export async function login(username: string, pin: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Login failed');
  }
  return res.json();
}
