<script lang="ts">
  interface Props {
    size?: string;
  }
  let { size = '40px' }: Props = $props();
</script>

<div class="spinner" style="width: {size}; height: {size};"></div>

<style>
  .spinner {
    border: 3px solid rgba(255, 255, 255, 0.05);
    border-top: 3px solid var(--color-general);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
