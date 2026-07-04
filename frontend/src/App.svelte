<script lang="ts">
  import { onMount } from 'svelte';
  import { user, activeTab } from './lib/store';
  import PinLogin from './lib/pages/PinLogin.svelte';
  import Sidebar from './lib/components/Sidebar.svelte';
  import Dashboard from './lib/pages/Dashboard.svelte';
  import Checkout from './lib/pages/Checkout.svelte';
  import Tables from './lib/pages/Tables.svelte';
  import Transfers from './lib/pages/Transfers.svelte';
  import Inventory from './lib/pages/Inventory.svelte';
  import Expenses from './lib/pages/Expenses.svelte';
  import Reports from './lib/pages/Reports.svelte';

  const validTabs = ['dashboard', 'checkout', 'tables', 'inventory', 'transfers', 'expenses', 'reports'];
  let isInitializing = $state(true);

  onMount(async () => {
    // 1. Global fetch interceptor to handle session expiration (401 Unauthorized)
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
        if (!url.includes('/api/auth/login')) {
          user.set(null);
          activeTab.set('checkout');
          window.location.hash = '';
        }
      }
      return response;
    };

    // 2. Check if session cookie exists by calling server auth/me
    try {
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const data = await meRes.json();
        if (data.user) {
          user.set(data.user);
        }
      }
    } catch (e) {
      console.error('Session restore failed:', e);
    } finally {
      isInitializing = false;
    }

    // 2. Handle URL hash routing
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (validTabs.includes(hash)) {
        if ($activeTab !== hash) {
          activeTab.set(hash);
        }
      } else {
        // If logged in and hash is empty/invalid, default to dashboard
        if ($user) {
          activeTab.set('dashboard');
          window.location.hash = '#dashboard';
        }
      }
    };

    // Initialize hash on load
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  });

  // Sync tab changes back to the URL hash
  $effect(() => {
    if (typeof window !== 'undefined' && $user && $activeTab) {
      const currentHash = window.location.hash.slice(1);
      if (currentHash !== $activeTab && validTabs.includes($activeTab)) {
        window.location.hash = '#' + $activeTab;
      }
    }
  });
</script>

{#if isInitializing}
  <div class="flex-center animate-fade-in" style="height: 100vh; width: 100vw; flex-direction: column; gap: 16px; background-color: var(--bg-primary); color: var(--text-primary);">
    <div class="spinner"></div>
    <span style="font-weight: 500; font-size: 1rem; letter-spacing: 0.5px;">Iniciando sistema...</span>
  </div>
{:else if !$user}
  <PinLogin />
{:else}
  <div class="app-layout">
    <Sidebar />
    <main class="main-content">
      {#if $activeTab === 'dashboard'}
        <Dashboard />
      {:else if $activeTab === 'checkout'}
        <Checkout />
      {:else if $activeTab === 'tables'}
        <Tables />
      {:else if $activeTab === 'inventory'}
        <Inventory />
      {:else if $activeTab === 'transfers'}
        <Transfers />
      {:else if $activeTab === 'expenses'}
        <Expenses />
      {:else if $activeTab === 'reports'}
        <Reports />
      {/if}
    </main>
  </div>
{/if}

<style>
  .app-layout {
    display: flex;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background-color: var(--bg-primary);
  }

  .main-content {
    flex: 1;
    height: 100%;
    padding: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--bg-secondary);
    border-top: 4px solid var(--color-general);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
