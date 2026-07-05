<script lang="ts">
  import { onMount } from 'svelte';
  import { user } from '../store';

  let users = $state<any[]>([]);
  let selectedUsername = $state('');
  let pin = $state('');
  let errorMsg = $state('');
  let isLoading = $state(false);

  onMount(() => {
    async function loadUsers() {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          users = await res.json();
          if (users.length > 0) {
            selectedUsername = users[0].username;
          }
        }
      } catch (e) {
        console.error('Error fetching users:', e);
        errorMsg = 'Error al cargar empleados';
      }
    }

    loadUsers();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLoading) return;

      // Ignore if user is typing inside an input element
      if (document.activeElement && 
          (document.activeElement.tagName === 'INPUT' || 
           document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        handleKey(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  function handleKey(num: string) {
    if (pin.length < 4) {
      pin += num;
      errorMsg = '';
    }

    if (pin.length === 4) {
      submitLogin();
    }
  }

  function handleClear() {
    pin = '';
    errorMsg = '';
  }

  function handleBackspace() {
    pin = pin.slice(0, -1);
    errorMsg = '';
  }

  async function submitLogin() {
    isLoading = true;
    errorMsg = '';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: selectedUsername, pin })
      });

      const data = await res.json();
      if (res.ok) {
        user.set(data.user);
      } else {
        errorMsg = data.error || 'Error al iniciar sesión';
        pin = ''; // Reset PIN on error
      }
    } catch (e) {
      errorMsg = 'Error de conexión con el servidor';
      pin = '';
    } finally {
      isLoading = false;
    }
  }

  // Keypad layouts
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
</script>

{#snippet loginHeader()}
  <div class="login-header">
    <div class="logo">🌿</div>
    <h2>Naturale POS</h2>
    <p>Selecciona tu usuario e ingresa tu PIN</p>
  </div>
{/snippet}

{#snippet userSelector()}
  <div class="form-group">
    <label for="user-select">Empleado</label>
    <select id="user-select" bind:value={selectedUsername} disabled={isLoading}>
      {#each users as u}
        <option value={u.username}>{u.name} ({u.role})</option>
      {/each}
    </select>
  </div>
{/snippet}

{#snippet pinDots()}
  <div class="pin-dots">
    {#each Array(4) as _, i}
      <div class="dot" class:filled={pin.length > i}></div>
    {/each}
  </div>
{/snippet}

{#snippet keypad()}
  <div class="keypad">
    {#each keys as key}
      <button class="key-btn" onclick={() => handleKey(key)} disabled={isLoading}>
        {key}
      </button>
    {/each}
    
    <button class="key-btn action-key text-danger" onclick={handleClear} disabled={isLoading}>
      C
    </button>
    
    <button class="key-btn" onclick={() => handleKey('0')} disabled={isLoading}>
      0
    </button>
    
    <button class="key-btn action-key text-general" onclick={handleBackspace} disabled={isLoading}>
      ⌫
    </button>
  </div>
{/snippet}

<div class="login-wrapper flex-center">
  <div class="login-container glass-panel animate-scale-up">
    {@render loginHeader()}

    {#if errorMsg}
      <div class="error-banner animate-fade-in">{errorMsg}</div>
    {/if}

    {@render userSelector()}

    <!-- PIN Visual Dots -->
    {@render pinDots()}

    <!-- Keypad Grid -->
    {@render keypad()}
  </div>
</div>

<style>
  .login-wrapper {
    height: 100vh;
    width: 100vw;
    background: radial-gradient(circle at center, #0a1f11 0%, #020804 100%);
  }

  .login-container {
    width: 100%;
    max-width: 380px;
    padding: 35px 25px;
    text-align: center;
  }

  .login-header {
    margin-bottom: 25px;
  }

  .logo {
    font-size: 3rem;
    margin-bottom: 10px;
    filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.3));
  }

  h2 {
    font-size: 1.8rem;
    font-weight: 600;
    margin-bottom: 6px;
    letter-spacing: -0.5px;
  }

  .login-header p {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .error-banner {
    background: var(--color-danger-glow);
    border: 1px solid rgba(244, 63, 94, 0.2);
    color: #fda4af;
    padding: 10px;
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
    margin-bottom: 20px;
  }

  .form-group {
    text-align: left;
    margin-bottom: 25px;
  }

  .form-group label {
    display: block;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 6px;
    font-weight: 500;
  }

  select {
    width: 100%;
    cursor: pointer;
  }

  .pin-dots {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-bottom: 30px;
  }

  .dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid var(--text-muted);
    transition: var(--transition-fast);
  }

  .dot.filled {
    background: var(--color-general);
    border-color: var(--color-general);
    box-shadow: 0 0 10px var(--color-general-glow);
    transform: scale(1.15);
  }

  .keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .key-btn {
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(16, 185, 129, 0.15);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 1.4rem;
    font-weight: 500;
    height: 65px;
    cursor: pointer;
    transition: var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    outline: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  }

  .key-btn:hover {
    background: #ffffff;
    border-color: var(--color-general);
    box-shadow: 0 4px 10px rgba(16, 185, 129, 0.08);
  }

  .key-btn:active {
    transform: scale(0.95);
    background: rgba(255, 255, 255, 0.9);
  }

  .action-key {
    font-size: 1.1rem;
  }
</style>
