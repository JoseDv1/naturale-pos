<script lang="ts">
  import { untrack } from 'svelte';
  import { me } from './lib/api/auth';
  import { user, activeTab } from './lib/store';
  import Spinner from './lib/components/atoms/Spinner.svelte';
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

  $effect(() => {
    untrack(async () => {
      // 1. Check if session cookie exists by calling server auth/me
      try {
        const data = await me();
        if (data.user) {
          user.set(data.user);
        }
      } catch (e) {
        console.error('Session restore failed:', e);
      } finally {
        isInitializing = false;
      }
    });

    // 2. Handle URL hash routing
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      untrack(() => {
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
      });
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

{#snippet activeView()}
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
{/snippet}

{#if isInitializing}
  <div class="flex-center animate-fade-in" style="height: 100vh; width: 100vw; flex-direction: column; gap: 16px; background-color: var(--bg-primary); color: var(--text-primary);">
    <Spinner size="40px" />
    <span style="font-weight: 500; font-size: 1rem; letter-spacing: 0.5px;">Iniciando sistema...</span>
  </div>
{:else if !$user}
  <PinLogin />
{:else}
  <div class="app-layout">
    <Sidebar />
    <main class="main-content">
      {@render activeView()}
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

</style>
