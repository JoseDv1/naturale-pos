export async function getExpenses() {
  const res = await fetch('/api/expenses');
  if (!res.ok) throw new Error('Failed to fetch expenses');
  return res.json();
}

export async function createExpense(expenseData: any) {
  const res = await fetch('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expenseData)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create expense');
  }
  return res.json();
}

export async function getExpenseCategories() {
  const res = await fetch('/api/expenses/categories');
  if (!res.ok) throw new Error('Failed to fetch expense categories');
  return res.json();
}

export async function createExpenseCategory(categoryData: { name: string; description?: string }) {
  const res = await fetch('/api/expenses/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(categoryData)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create expense category');
  }
  return res.json();
}

export async function updateExpenseCategory(id: string, categoryData: { name: string; description?: string }) {
  const res = await fetch(`/api/expenses/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(categoryData)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update expense category');
  }
  return res.json();
}

export async function deleteExpenseCategory(id: string) {
  const res = await fetch(`/api/expenses/categories/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete expense category');
  }
  return res.json();
}
