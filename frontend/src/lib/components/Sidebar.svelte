<script lang="ts">
  import { logout as apiLogout } from '../api/auth';
  import { getCurrentShift } from '../api/shifts';
  import { user, activeTab, currentShift, refreshTrigger } from '../store';
  import SidebarMenuItem from './molecules/SidebarMenuItem.svelte';
  import Logo from './atoms/Logo.svelte';
  import OpenShiftModal from './organisms/OpenShiftModal.svelte';
  import CloseShiftModal from './organisms/CloseShiftModal.svelte';

  async function logout() {
    try {
      await apiLogout();
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
    { id: 'categories', label: 'Categorías', icon: '🏷️' },
    { id: 'transfers', label: 'Traslados de Stock', icon: '🔄' },
    { id: 'expenses', label: 'Gastos y Suministros', icon: '💸' },
    { id: 'reports', label: 'Estadísticas y Reportes', icon: '📊' },
  ];

  let showOpenShiftModal = $state(false);
  let showCloseShiftModal = $state(false);

  async function loadCurrentShift() {
    try {
      const data = await getCurrentShift();
      if (data && data.shift && data.shift.status === 'OPEN') {
        currentShift.set(data);
      } else {
        currentShift.set(null);
      }
    } catch (e) {
      currentShift.set(null);
    }
  }

  $effect(() => {
    const _ = $refreshTrigger;
    loadCurrentShift();
  });

  let hasActiveShift = $derived(!!$currentShift?.shift && $currentShift.shift.status === 'OPEN');
  let activeBalance = $derived(
    Number($currentShift?.realTimeTotals?.expectedCash ?? $currentShift?.shift?.initialCash ?? 0)
  );
  let cashierName = $derived($currentShift?.shift?.user?.name || '');
</script>

<aside class="sidebar glass-panel">
  <div class="brand">
    <Logo variant="full" size="md" />
  </div>

  <nav class="nav-menu">
    {#each menuItems as item}
      <SidebarMenuItem {item} active={$activeTab === item.id} onclick={() => activeTab.set(item.id)} />
    {/each}
  </nav>

  <!-- Cash Drawer Status Widget / Pill (R1) -->
  <div class="drawer-widget glass-panel" class:is-open={hasActiveShift}>
    <div class="drawer-top-row">
      <div class="status-indicator">
        <span class="status-dot"></span>
        <span class="status-text">{hasActiveShift ? 'Turno Abierto' : 'Caja Cerrada'}</span>
      </div>
      {#if hasActiveShift}
        <span class="drawer-badge">Activo</span>
      {/if}
    </div>

    {#if hasActiveShift}
      <div class="drawer-balance-box">
        <span class="balance-label">Efectivo en Caja</span>
        <strong class="balance-amount">${activeBalance.toLocaleString()}</strong>
      </div>
      {#if cashierName}
        <div class="drawer-cashier-row">
          <span>👤 {cashierName}</span>
        </div>
      {/if}
      <button type="button" class="btn-drawer-action btn-close-drawer" onclick={() => (showCloseShiftModal = true)}>
        🔒 Cerrar Caja
      </button>
    {:else}
      <p class="drawer-closed-text">Se requiere un turno abierto para operar ventas.</p>
      <button type="button" class="btn-drawer-action btn-open-drawer" onclick={() => (showOpenShiftModal = true)}>
        🔓 Abrir Turno
      </button>
    {/if}
  </div>

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
    <button class="logout-btn" onclick={logout} title="Cerrar Sesión" aria-label="Cerrar Sesión">
      🚪
    </button>
  </div>
</aside>

<!-- Modals for Opening & Closing Shifts -->
{#if showOpenShiftModal}
  <OpenShiftModal
    onclose={() => (showOpenShiftModal = false)}
    onsuccess={() => {
      showOpenShiftModal = false;
      loadCurrentShift();
    }}
  />
{/if}

{#if showCloseShiftModal}
  <CloseShiftModal
    shiftData={$currentShift}
    onclose={() => (showCloseShiftModal = false)}
    onsuccess={() => {
      loadCurrentShift();
    }}
    onopennew={() => {
      showCloseShiftModal = false;
      showOpenShiftModal = true;
    }}
  />
{/if}

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
    gap: 14px;
  }

  .brand {
    display: flex;
    align-items: center;
    margin-bottom: 15px;
    padding: 0 8px;
  }

  .nav-menu {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    overflow-y: auto;
  }

  /* Cash Drawer Widget Styling */
  .drawer-widget {
    padding: 12px;
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .drawer-widget.is-open {
    background: rgba(34, 197, 94, 0.04);
    border-color: rgba(34, 197, 94, 0.25);
  }

  .drawer-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e74c3c;
    box-shadow: 0 0 6px rgba(231, 76, 60, 0.6);
  }

  .drawer-widget.is-open .status-dot {
    background: #2ecc71;
    box-shadow: 0 0 6px rgba(46, 204, 113, 0.8);
  }

  .status-text {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .drawer-badge {
    font-size: 0.68rem;
    background: rgba(46, 204, 113, 0.15);
    color: #2ecc71;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 600;
  }

  .drawer-balance-box {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: rgba(0, 0, 0, 0.2);
    padding: 6px 10px;
    border-radius: 4px;
  }

  .balance-label {
    font-size: 0.72rem;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .balance-amount {
    font-size: 1.1rem;
    color: var(--color-general);
    font-weight: 700;
  }

  .drawer-cashier-row {
    font-size: 0.78rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .drawer-closed-text {
    font-size: 0.76rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.3;
  }

  .btn-drawer-action {
    width: 100%;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
    border: 1px solid var(--border-glass);
    text-align: center;
  }

  .btn-open-drawer {
    background: rgba(46, 204, 113, 0.15);
    color: #2ecc71;
    border-color: rgba(46, 204, 113, 0.35);
  }

  .btn-open-drawer:hover {
    background: rgba(46, 204, 113, 0.25);
  }

  .btn-close-drawer {
    background: rgba(231, 76, 60, 0.12);
    color: #e74c3c;
    border-color: rgba(231, 76, 60, 0.3);
  }

  .btn-close-drawer:hover {
    background: rgba(231, 76, 60, 0.22);
  }

  .user-profile {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 12px;
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
