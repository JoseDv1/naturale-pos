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
    color: var(--color-general);
  }

  .badge-raw {
    background: rgba(99, 102, 241, 0.12);
    color: #4338ca;
    border: 1px solid rgba(99, 102, 241, 0.25);
  }

  .badge-completed {
    background: var(--color-market-glow);
    color: var(--color-market);
  }

  .badge-transfer {
    background: rgba(99, 102, 241, 0.12);
    color: #4338ca;
    border: 1px solid rgba(99, 102, 241, 0.25);
  }

  .badge-cancelled {
    background: var(--color-danger-glow);
    color: var(--color-danger);
  }

  .badge-zero {
    background: var(--color-danger-glow);
    color: var(--color-danger);
    border: 1px solid rgba(190, 18, 60, 0.25);
  }

  .badge-low {
    background: var(--color-cafe-glow);
    color: var(--color-cafe);
    border: 1px solid rgba(180, 83, 9, 0.25);
  }
</style>
