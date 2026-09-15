<script lang="ts">
  import Badge from '../atoms/Badge.svelte';

  interface Props {
    expense: any;
  }

  let { expense: exp }: Props = $props();

  const categoryLabels: Record<string, { label: string; icon?: string }> = {
    utilities: { label: 'Servicios Públicos', icon: '💡' },
    rent: { label: 'Arriendo / Local', icon: '🏢' },
    supplies: { label: 'Papelería / Suministros', icon: '📦' },
    payroll: { label: 'Nómina / Sueldos', icon: '👥' },
    maintenance: { label: 'Mantenimiento / Aseo', icon: '🧹' },
    marketing: { label: 'Publicidad y Marketing', icon: '📢' },
    services: { label: 'Servicios Profesionales', icon: '📑' },
    taxes: { label: 'Impuestos y Tasas', icon: '🏛️' },
    transport: { label: 'Transporte y Domicilios', icon: '🚚' },
    equipment: { label: 'Equipamiento y Menaje', icon: '⚙️' },
    waste: { label: 'Mermas y Pérdidas', icon: '🗑️' },
    other: { label: 'Otros Egresos', icon: '💸' },
    INTERNAL_TRANSFER: { label: 'Traslado Interno', icon: '🔄' },
  };

  let formattedCategory = $derived.by(() => {
    const catKey = exp.category;
    const found = categoryLabels[catKey];
    if (found) {
      return `${found.icon} ${found.label}`;
    }
    return `🏷️ ${catKey}`;
  });
</script>

<tr class="animate-fade-in">
  <td>{exp.date || exp.createdAt ? new Date(exp.date || exp.createdAt).toLocaleString() : '—'}</td>
  <td>
    <strong class="expense-desc-txt">{exp.description}</strong>
  </td>
  <td>
    <span class="category-tag" title={exp.category}>{formattedCategory}</span>
  </td>
  <td>
    <Badge
      text={exp.department === 'MARKET' ? 'Mercado' : exp.department === 'CAFE' ? 'Café' : 'General'}
      type={exp.department === 'MARKET' ? 'market' : exp.department === 'CAFE' ? 'cafe' : 'general'}
    />
  </td>
  <td>
    {#if exp.items && exp.items.length > 0}
      <div class="exp-items-cell">
        {#each exp.items as item}
          <span>• {item.product.name} (x{item.quantity})</span>
        {/each}
      </div>
    {:else}
      <span class="text-muted italic">N/A (Gasto Administrativo)</span>
    {/if}
  </td>
  <td class="text-right">
    <strong class="text-danger">${Number(exp.amount || 0).toLocaleString()}</strong>
  </td>
  <td>{exp.user?.name || 'Sistema'}</td>
</tr>

<style>
  .expense-desc-txt {
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .category-tag {
    font-size: 0.76rem;
    background: rgba(255, 255, 255, 0.06);
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 500;
    white-space: nowrap;
    display: inline-block;
    border: 1px solid var(--border-glass);
    color: var(--text-secondary);
  }

  .exp-items-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.82rem;
    text-align: left;
  }

  .text-danger {
    color: var(--color-danger);
  }
</style>
