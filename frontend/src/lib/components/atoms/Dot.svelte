<script lang="ts">
  interface Props {
    active: boolean;
  }
  let { active }: Props = $props();
</script>

<div class="pin-dot" class:active></div>

<style>
  .pin-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid rgba(16, 185, 129, 0.3);
    background: transparent;
    transition: all 0.15s ease;
  }

  .pin-dot.active {
    background: var(--color-general);
    border-color: var(--color-general);
    box-shadow: 0 0 12px var(--color-general);
    transform: scale(1.15);
  }
</style>
