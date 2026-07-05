<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label?: string;
    type?: 'button' | 'submit';
    variant?: 'general' | 'secondary' | 'market' | 'cafe' | 'danger' | 'keypad' | 'keypad-action' | 'calc-num' | 'calc-num-zero' | 'calc-op' | 'calc-equal' | 'calc-clear' | 'flat';
    onclick?: () => void;
    disabled?: boolean;
    extraClass?: string;
    children?: Snippet;
  }

  let {
    label = '',
    type = 'button',
    variant = 'general',
    onclick,
    disabled = false,
    extraClass = '',
    children
  }: Props = $props();
</script>

<button
  {type}
  class="btn-atom btn-{variant} {extraClass}"
  {onclick}
  {disabled}
>
  {#if children}
    {@render children()}
  {:else}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html label}
  {/if}
</button>

<style>
  /* General button base style */
  .btn-atom {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    transition: var(--transition-fast);
    cursor: pointer;
    outline: none;
    box-sizing: border-box;
  }

  .btn-atom:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Variant standard styles */
  .btn-general {
    height: 40px;
    background: var(--color-general);
    color: #fff;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0 16px;
  }
  .btn-general:hover:not(:disabled) {
    background: var(--color-general-hover);
  }

  .btn-secondary {
    height: 40px;
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 0 16px;
  }
  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
  }

  .btn-market {
    height: 40px;
    background: var(--color-market);
    color: #fff;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0 16px;
  }
  .btn-market:hover:not(:disabled) {
    background: #059669;
  }

  .btn-cafe {
    height: 40px;
    background: var(--color-cafe);
    color: #fff;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0 16px;
  }
  .btn-cafe:hover:not(:disabled) {
    background: #d97706;
  }

  .btn-danger {
    height: 40px;
    background: var(--color-danger);
    color: #fff;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0 16px;
  }
  .btn-danger:hover:not(:disabled) {
    background: #e11d48;
  }

  .btn-flat {
    background: transparent;
    border: none;
    padding: 0;
  }

  /* Keypad variant styles */
  .btn-keypad {
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(16, 185, 129, 0.15);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 1.4rem;
    font-weight: 500;
    height: 65px;
    width: 100%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  }
  .btn-keypad:hover:not(:disabled) {
    background: #ffffff;
    border-color: var(--color-general);
    box-shadow: 0 4px 10px rgba(16, 185, 129, 0.08);
  }
  .btn-keypad:active:not(:disabled) {
    transform: scale(0.95);
  }

  .btn-keypad-action {
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(16, 185, 129, 0.15);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 1.1rem;
    font-weight: 500;
    height: 65px;
    width: 100%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  }
  .btn-keypad-action:hover:not(:disabled) {
    background: #ffffff;
    border-color: var(--color-general);
    box-shadow: 0 4px 10px rgba(16, 185, 129, 0.08);
  }
  .btn-keypad-action:active:not(:disabled) {
    transform: scale(0.95);
  }

  /* Calculator variant styles */
  .btn-calc-num {
    height: 42px;
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
    font-weight: 600;
    width: 100%;
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-primary);
  }
  .btn-calc-num:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
  }
  .btn-calc-num:active:not(:disabled) {
    transform: scale(0.95);
  }

  .btn-calc-num-zero {
    grid-column: span 2;
    height: 42px;
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
    font-weight: 600;
    width: 100%;
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-primary);
  }
  .btn-calc-num-zero:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
  }
  .btn-calc-num-zero:active:not(:disabled) {
    transform: scale(0.95);
  }

  .btn-calc-op {
    height: 42px;
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
    font-weight: 600;
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-general);
  }
  .btn-calc-op:hover:not(:disabled) {
    background: var(--color-general-glow);
  }
  .btn-calc-op:active:not(:disabled) {
    transform: scale(0.95);
  }

  .btn-calc-clear {
    grid-column: span 3;
    height: 42px;
    border: 1px solid rgba(244, 63, 94, 0.2);
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
    font-weight: 600;
    width: 100%;
    background: rgba(244, 63, 94, 0.08);
    color: var(--color-danger);
  }
  .btn-calc-clear:hover:not(:disabled) {
    background: var(--color-danger-glow);
    border-color: var(--color-danger);
  }
  .btn-calc-clear:active:not(:disabled) {
    transform: scale(0.95);
  }

  .btn-calc-equal {
    height: 42px;
    border: 1px solid var(--color-general);
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
    font-weight: 600;
    width: 100%;
    background: var(--color-general);
    color: #fff;
  }
  .btn-calc-equal:hover:not(:disabled) {
    background: var(--color-general-hover);
    transform: scale(1.02);
  }
  .btn-calc-equal:active:not(:disabled) {
    transform: scale(0.95);
  }
</style>
