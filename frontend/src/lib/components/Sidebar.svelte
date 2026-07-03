<script lang="ts">
  import { user, activeTab } from '../store';

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout request failed:', e);
    }
    user.set(null);
    activeTab.set('checkout');
    window.location.hash = '';
  }

  const menuItems = [
    { id: 'dashboard', label: 'Inicio / Resumen', icon: '📈' },
    { id: 'checkout', label: 'Terminal de Venta', icon: '🛒' },
    { id: 'tables', label: 'Mapa de Mesas', icon: '🪑' },
    { id: 'inventory', label: 'Inventario', icon: '📦' },
    { id: 'transfers', label: 'Traslados de Stock', icon: '🔄' },
    { id: 'expenses', label: 'Gastos y Suministros', icon: '💸' },
    { id: 'reports', label: 'Estadísticas y Reportes', icon: '📊' },
  ];
</script>

<aside class="sidebar glass-panel">
  <div class="brand">
    <span class="logo">🌿</span>
    <div class="brand-info">
      <h1>Naturale</h1>
      <span>Mercado & Café</span>
    </div>
  </div>

  <nav class="nav-menu">
    {#each menuItems as item}
      <button
        class="nav-item"
        class:active={$activeTab === item.id}
        onclick={() => activeTab.set(item.id)}
      >
        <span class="nav-icon">{item.icon}</span>
        <span class="nav-label">{item.label}</span>
      </button>
    {/each}
  </nav>

  <div class="user-profile">
    {#if $user}
      <div class="user-avatar">
        {$user.name.charAt(0).toUpperCase()}
      </div>
      <div class="user-info">
        <span class="username">{$user.name}</span>
        <span class="user-role">{$user.role === 'ADMIN' ? 'Administrador' : 'Cajero'}</span>
      </div>
    {/if}
    <button class="logout-btn" onclick={logout} title="Cerrar Sesión">
      🚪
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: 260px;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 24px 16px;
    border-radius: 0;
    border-top: none;
    border-bottom: none;
    border-left: none;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 35px;
    padding: 0 8px;
  }

  .brand .logo {
    font-size: 2rem;
    filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.2));
  }

  .brand-info h1 {
    font-size: 1.15rem;
    font-weight: 600;
    line-height: 1;
    margin-bottom: 2px;
  }

  .brand-info span {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .nav-menu {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-weight: 500;
    font-size: 0.95rem;
    text-align: left;
    transition: var(--transition-fast);
    outline: none;
    width: 100%;
  }

  .nav-item:hover {
    background: rgba(16, 185, 129, 0.06);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--color-general-glow);
    color: #a5b4fc;
    border: 1px solid rgba(99, 102, 241, 0.25);
  }

  .nav-icon {
    font-size: 1.2rem;
  }

  .user-profile {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 15px;
    border-top: 1px solid var(--border-glass);
  }

  .user-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--color-general);
    color: #fff;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
    box-shadow: 0 0 10px var(--color-general-glow);
  }

  .user-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .user-info .username {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  .user-info .user-role {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .logout-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 8px;
    border-radius: var(--radius-sm);
    transition: var(--transition-fast);
    outline: none;
  }

  .logout-btn:hover {
    background: var(--color-danger-glow);
    transform: scale(1.05);
  }
</style>
