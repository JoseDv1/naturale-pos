<script lang="ts">
  import { untrack } from 'svelte';
  import { user } from '../store';
  import { getUsers } from '../api/users';
  import { login } from '../api/auth';
  import Button from '../components/atoms/Button.svelte';
  import Dot from '../components/atoms/Dot.svelte';

  let usersPromise = $state<Promise<any[]>>(getUsers());
  let selectedUsername = $state('');
  let pin = $state('');
  let errorMsg = $state('');
  let isLoading = $state(false);

  $effect(() => {
    usersPromise.then((resolvedUsers) => {
      if (resolvedUsers.length > 0 && !selectedUsername) {
        selectedUsername = resolvedUsers[0].username;
      }
    }).catch((e) => {
      console.error('Error fetching users:', e);
      errorMsg = 'Error al cargar empleados';
    });
  });

  $effect(() => {
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
      const data = await login(selectedUsername, pin);
      user.set(data.user);
    } catch (e: any) {
      errorMsg = e.message || 'Error al iniciar sesión';
      pin = ''; // Reset PIN on error
    } finally {
      isLoading = false;
    }
  }

  // Keypad layouts
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
</script>

<div class="login-wrapper flex-center">
  <div class="login-container glass-panel animate-scale-up">
    <div class="login-header">
      <div class="logo">🌿</div>
      <h2>Naturale POS</h2>
      <p>Selecciona tu usuario e ingresa tu PIN</p>
    </div>

    {#if errorMsg}
      <div class="error-banner animate-fade-in">{errorMsg}</div>
    {/if}

    <div class="form-group">
      <label for="user-select">Empleado</label>
      {#await usersPromise}
        <div style="padding: 10px; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">Cargando empleados...</div>
      {:then resolvedUsers}
        <select id="user-select" bind:value={selectedUsername} disabled={isLoading}>
          {#each resolvedUsers as u}
            <option value={u.username}>{u.name} ({u.role})</option>
          {/each}
        </select>
      {:catch error}
        <div class="error-banner animate-fade-in">Error al cargar empleados: {error.message}</div>
      {/await}
    </div>

    <!-- PIN Visual Dots -->
    <div class="pin-dots">
      {#each Array(4) as _, i}
        <Dot active={pin.length > i} />
      {/each}
    </div>

    <!-- Keypad Grid -->
    <div class="keypad">
      {#each keys as key}
        <Button label={key} variant="keypad" onclick={() => handleKey(key)} disabled={isLoading} />
      {/each}
      
      <Button label="C" variant="keypad-action" onclick={handleClear} extraClass="text-danger" disabled={isLoading} />
      <Button label="0" variant="keypad" onclick={() => handleKey('0')} disabled={isLoading} />
      <Button label="⌫" variant="keypad-action" onclick={handleBackspace} extraClass="text-general" disabled={isLoading} />
    </div>
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



  .keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
</style>
