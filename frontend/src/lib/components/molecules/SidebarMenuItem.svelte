<script lang="ts">
  import Button from "../atoms/Button.svelte";

  interface Props {
    item: { id: string; label: string; icon: string };
    active: boolean;
    onclick: () => void;
  }

  let { item, active, onclick }: Props = $props();
</script>

<Button variant="flat" extraClass="nav-item {active ? 'active' : ''}" {onclick}>
  <span class="nav-icon">{item.icon}</span>
  <span class="nav-label">{item.label}</span>
</Button>

<style>
  :global(.nav-item) {
    display: flex;
    align-items: center;
    justify-content: flex-start !important;
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

  :global(.nav-item:hover) {
    background: rgba(16, 185, 129, 0.06);
    color: var(--text-primary);
  }

  :global(.nav-item.active) {
    background: var(--color-general-glow);
    color: #a5b4fc;
    border: 1px solid rgba(99, 102, 241, 0.25) !important;
  }

  .nav-icon {
    font-size: 1.2rem;
  }
</style>
