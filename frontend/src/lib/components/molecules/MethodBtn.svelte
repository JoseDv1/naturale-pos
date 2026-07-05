<script lang="ts">
  import Button from '../atoms/Button.svelte';

  interface Props {
    method: string;
    currentMethod: string;
    label: string;
    onclick: (method: string) => void;
  }

  let { method, currentMethod, label, onclick }: Props = $props();
</script>

<Button
  variant="flat"
  extraClass="method-btn {currentMethod === method ? 'active' : ''}"
  onclick={() => onclick(method)}
>
  {label}
</Button>

<style>
  :global(.method-btn) {
    border: 1px solid var(--border-glass);
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-secondary);
    padding: 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.88rem;
    font-weight: 500;
    transition: var(--transition-fast);
    outline: none;
    width: 100%;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  :global(.method-btn:hover) {
    background: rgba(255, 255, 255, 0.04);
  }

  :global(.method-btn.active) {
    background: var(--color-general-glow);
    color: #a5b4fc;
    border-color: var(--color-general) !important;
  }
</style>
