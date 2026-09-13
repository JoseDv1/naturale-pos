<script lang="ts">
  interface Props {
    size?: 'sm' | 'md' | 'lg' | 'xl' | number;
    variant?: 'full' | 'icon' | 'stacked';
    title?: string;
    subtitle?: string;
    showSubtitle?: boolean;
    animated?: boolean;
    class?: string;
  }

  let {
    size = 'md',
    variant = 'full',
    title = 'Naturale',
    subtitle = 'Mercado & Café',
    showSubtitle = true,
    animated = false,
    class: customClass = '',
  }: Props = $props();

  const sizePixelMap: Record<string, number> = {
    sm: 32,
    md: 42,
    lg: 56,
    xl: 76,
  };

  const pixelSize = $derived(
    typeof size === 'number' ? size : (sizePixelMap[size] ?? 42)
  );

  const fontSizeClass = $derived(
    typeof size === 'string' ? `size-${size}` : 'size-md'
  );
</script>

{#snippet logoMark()}
  <div 
    class="logo-icon-wrapper" 
    style="width: {pixelSize}px; height: {pixelSize}px;"
    class:animate-pulse-gentle={animated}
  >
    <svg 
      viewBox="0 0 64 64" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      class="logo-svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logoBgGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ecfdf5" />
          <stop offset="100%" stop-color="#d1fae5" />
        </linearGradient>
        <linearGradient id="logoLeafGrad" x1="14" y1="52" x2="38" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#047857" />
          <stop offset="50%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#34d399" />
        </linearGradient>
        <linearGradient id="logoCafeGrad" x1="26" y1="52" x2="50" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#b45309" />
          <stop offset="50%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#fbbf24" />
        </linearGradient>
        <filter id="logoDropShadow" x="0" y="0" width="64" height="64" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#064e3b" flood-opacity="0.18" />
        </filter>
      </defs>

      <!-- Badge Background -->
      <rect width="64" height="64" rx="18" fill="url(#logoBgGrad)" />
      <rect width="62" height="62" x="1" y="1" rx="17" stroke="#10b981" stroke-opacity="0.25" stroke-width="1.5" />

      <!-- Botanical & Coffee Emblem -->
      <g filter="url(#logoDropShadow)">
        <!-- Green Leaf Petal (Market) -->
        <path d="M16 46C16 46 15 28 29 16C37 9 44 13 44 13C44 13 36 25 28 35C21 43.5 16 46 16 46Z" fill="url(#logoLeafGrad)" />
        
        <!-- Amber Warmth Bean Curve (Café) -->
        <path d="M48 20C48 20 49 38 35 48C27 55 20 51 20 51C20 51 28 39 36 29C43 20.5 48 20 48 20Z" fill="url(#logoCafeGrad)" />
        
        <!-- Harmonizing Central Light Arc -->
        <path d="M22 41C27 34 33 27 41 18" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity="0.9" />
        
        <!-- Organic Sparkle Accent -->
        <circle cx="44" cy="13" r="2" fill="#34d399" />
      </g>
    </svg>
  </div>
{/snippet}

{#snippet brandText()}
  <div class="logo-typography {fontSizeClass}">
    <span class="logo-title">{title}</span>
    {#if showSubtitle && subtitle}
      <span class="logo-subtitle">{subtitle}</span>
    {/if}
  </div>
{/snippet}

<div 
  class="naturale-logo {variant} {customClass}" 
  role="img" 
  aria-label="{title} - {subtitle}"
>
  {#if variant === 'icon'}
    {@render logoMark()}
  {:else if variant === 'stacked'}
    <div class="stacked-layout">
      {@render logoMark()}
      {@render brandText()}
    </div>
  {:else}
    <div class="full-layout">
      {@render logoMark()}
      {@render brandText()}
    </div>
  {/if}
</div>

<style>
  .naturale-logo {
    display: inline-flex;
    align-items: center;
    user-select: none;
  }

  .full-layout {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .stacked-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
  }

  .logo-icon-wrapper {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md, 14px);
    transition: transform var(--transition-normal, 0.25s ease);
  }

  .naturale-logo:hover .logo-icon-wrapper {
    transform: scale(1.04) rotate(1deg);
  }

  .logo-svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .logo-typography {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .logo-title {
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-primary, #112217);
    line-height: 1.1;
  }

  .logo-subtitle {
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-market, #15803d);
    line-height: 1.2;
    margin-top: 2px;
  }

  /* Size variations for text */
  .size-sm .logo-title {
    font-size: 1.1rem;
  }
  .size-sm .logo-subtitle {
    font-size: 0.65rem;
  }

  .size-md .logo-title {
    font-size: 1.35rem;
  }
  .size-md .logo-subtitle {
    font-size: 0.72rem;
  }

  .size-lg .logo-title {
    font-size: 1.65rem;
  }
  .size-lg .logo-subtitle {
    font-size: 0.8rem;
  }

  .size-xl .logo-title {
    font-size: 2.1rem;
  }
  .size-xl .logo-subtitle {
    font-size: 0.95rem;
  }

  .animate-pulse-gentle {
    animation: pulseGentle 3s ease-in-out infinite;
  }

  @keyframes pulseGentle {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.03);
    }
  }
</style>
