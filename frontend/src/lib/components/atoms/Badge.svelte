<script lang="ts">
  interface Props {
    text: string;
    type: 'market' | 'cafe' | 'general' | 'raw' | 'completed' | 'transfer' | 'cancelled' | 'zero' | 'low';
    extraClass?: string;
  }

  let { text, type, extraClass = '' }: Props = $props();
</script>

<span class="badge badge-{type} {extraClass}">
  {text}
</span>

<style>
  .badge {
    font-size: 0.72rem;
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 600;
    text-transform: uppercase;
    display: inline-block;
  }

  .badge-market {
    background: var(--color-market-glow);
    color: var(--color-market);
  }

  .badge-cafe {
    background: var(--color-cafe-glow);
    color: var(--color-cafe);
  }

  .badge-general {
    background: var(--color-general-glow);
    color: #a5b4fc;
  }

  .badge-raw {
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
  }

  .badge-completed {
    background: var(--color-market-glow);
    color: var(--color-market);
  }

  .badge-transfer {
    background: var(--color-general-glow);
    color: #a5b4fc;
  }

  .badge-cancelled {
    background: var(--color-danger-glow);
    color: var(--color-danger);
  }

  .badge-zero {
    background: rgba(244, 63, 94, 0.12);
    color: var(--color-danger);
    border: 1px solid rgba(244, 63, 94, 0.2);
  }

  .badge-low {
    background: rgba(245, 158, 11, 0.12);
    color: var(--color-cafe);
    border: 1px solid rgba(245, 158, 11, 0.2);
  }
</style>
