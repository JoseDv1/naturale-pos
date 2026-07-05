<script lang="ts">
  interface Props {
    name: string;
    profit: number;
    revenue: number;
    expenses: number;
    progressWidth: number;
    colorClass: string;
    textClass: string;
  }

  let {
    name,
    profit,
    revenue,
    expenses,
    progressWidth,
    colorClass,
    textClass
  }: Props = $props();
</script>

<div class="dept-card">
  <div class="dept-title-row">
    <span class="dept-name {textClass}">{name}</span>
    <strong class="dept-net-profit">${profit.toLocaleString()}</strong>
  </div>
  <div class="progress-bar-container">
    <div class="progress-bar {colorClass}" style="width: {progressWidth}%"></div>
  </div>
  <div class="dept-details">
    <span>Ventas: ${revenue.toLocaleString()}</span>
    <span>Gastos: ${expenses.toLocaleString()}</span>
  </div>
</div>

<style>
  .dept-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .dept-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .dept-name {
    font-size: 0.88rem;
    font-weight: 500;
  }

  .dept-net-profit {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .progress-bar-container {
    height: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    overflow: hidden;
    width: 100%;
  }

  .progress-bar {
    height: 100%;
    border-radius: 4px;
  }
</style>
