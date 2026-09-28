/**
 * Naturale - Catálogo Web de Productos & Café
 * Lógica de filtrado, búsqueda instantánea, variantes y enlaces a WhatsApp
 */

(function () {
  'use strict';

  // 1. Configuración por defecto si no está cargado config.js
  const config = window.CATALOG_CONFIG || {
    storeName: 'Naturale',
    subtitle: 'Mercado Saludable & Café',
    tagline: 'Alimentación consciente, café de especialidad y bienestar.',
    whatsappNumber: '573001234567',
    whatsappGreeting: '¡Hola Naturale! 🌿 Vengo del catálogo web y me interesa ordenar:',
    whatsappGeneralMessage: '¡Hola Naturale! 🌿 Quisiera consultar sobre los productos disponibles en su catálogo.',
    currency: { symbol: '$', locale: 'es-CO', currencyCode: 'COP' },
    social: {
      instagram: 'https://instagram.com/naturale_col',
      location: 'Guatapé, Antioquia, Colombia',
      hours: 'Lunes a Domingo: 8:00 AM - 7:00 PM'
    }
  };

  // 2. Datos del catálogo
  const catalogData = window.CATALOG_DATA || { products: [], categories: [] };

  // Formateador de moneda colombiana
  const currencyFormatter = new Intl.NumberFormat(config.currency.locale || 'es-CO', {
    style: 'currency',
    currency: config.currency.currencyCode || 'COP',
    maximumFractionDigits: 0
  });

  function formatMoney(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) return '$ 0';
    return currencyFormatter.format(amount);
  }

  // Filtrar productos visibles (excluir internos como propinas TIPS y productos inactivos)
  const allProducts = (catalogData.products || [])
    .filter(p => p.active !== false && p.sku !== 'TIPS')
    .map(p => {
      // Normalizar variantes activas
      const activeVariants = (p.variants || []).filter(v => v.active !== false);
      return {
        ...p,
        variants: activeVariants
      };
    });

  // Estado de la aplicación
  const state = {
    searchQuery: '',
    selectedDept: 'ALL',      // 'ALL' | 'CAFE' | 'MARKET'
    selectedCategory: 'ALL',  // 'ALL' | categoryName
    selectedVariants: {},     // productId -> variantId
    filteredProducts: [...allProducts],
    renderedCount: 0,
    pageSize: 60
  };

  // Inicializar variantes seleccionadas por defecto (primera variante)
  allProducts.forEach(p => {
    if (p.variants && p.variants.length > 0) {
      state.selectedVariants[p.id] = p.variants[0].id;
    }
  });

  // Elementos del DOM
  const dom = {
    storeTitle: document.getElementById('store-title'),
    storeSubtitle: document.getElementById('store-subtitle'),
    storeTagline: document.getElementById('store-tagline'),
    storeHours: document.getElementById('store-hours'),
    storeLocation: document.getElementById('store-location'),
    footerTagline: document.getElementById('footer-tagline'),
    footerWaLink: document.getElementById('footer-wa-link'),
    footerIgLink: document.getElementById('footer-ig-link'),
    currentYear: document.getElementById('current-year'),
    floatingWa: document.getElementById('floating-whatsapp'),
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    deptPills: document.querySelectorAll('.dept-pill'),
    categoriesContainer: document.getElementById('categories-container'),
    allCount: document.getElementById('all-count'),
    visibleCount: document.getElementById('visible-count'),
    filterIndicator: document.getElementById('filter-indicator'),
    productsGrid: document.getElementById('products-grid'),
    emptyState: document.getElementById('empty-state'),
    btnResetFilters: document.getElementById('btn-reset-filters')
  };

  // =========================================================================
  // INICIALIZACIÓN DE TEXTOS Y ENLACES GENERALES
  // =========================================================================
  function initHeaderAndFooter() {
    if (dom.storeTitle) dom.storeTitle.textContent = config.storeName;
    if (dom.storeSubtitle) dom.storeSubtitle.textContent = config.subtitle;
    if (dom.storeTagline) dom.storeTagline.textContent = config.tagline;
    if (dom.storeHours && config.social.hours) dom.storeHours.textContent = config.social.hours;
    if (dom.storeLocation && config.social.location) dom.storeLocation.textContent = config.social.location;
    if (dom.footerTagline) dom.footerTagline.textContent = config.tagline;
    if (dom.currentYear) dom.currentYear.textContent = new Date().getFullYear();

    // Enlace flotante de WhatsApp
    const generalWaUrl = `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(config.whatsappGeneralMessage)}`;
    if (dom.floatingWa) dom.floatingWa.href = generalWaUrl;
    if (dom.footerWaLink) dom.footerWaLink.href = generalWaUrl;
    if (dom.footerIgLink && config.social.instagram) dom.footerIgLink.href = config.social.instagram;
  }

  // =========================================================================
  // GENERADOR DE ENLACE DE WHATSAPP POR PRODUCTO
  // =========================================================================
  function generateWhatsAppUrl(product, variant = null) {
    const greeting = config.whatsappGreeting || '¡Hola! Me interesa este producto:';
    const variantText = variant ? ` (${variant.name})` : '';
    const priceText = formatMoney(variant ? variant.price : product.price);
    const skuText = variant ? variant.sku : product.sku;

    const message = `${greeting}\n\n• *${product.name}*${variantText}\n• Precio: *${priceText}*\n${skuText ? `• Ref/SKU: ${skuText}` : ''}\n\n¿Tienen disponibilidad?`;

    return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  // =========================================================================
  // GESTIÓN DE CATEGORÍAS Y CONTADORES
  // =========================================================================
  function updateCategoryChips() {
    // Filtrar productos según departamento para contar por categoría
    const baseProducts = allProducts.filter(p => {
      if (state.selectedDept !== 'ALL' && p.department !== state.selectedDept) return false;
      return true;
    });

    // Contar productos por categoría
    const categoryCounts = {};
    baseProducts.forEach(p => {
      const cat = p.categoryName || 'General';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    // Total de productos en este departamento
    if (dom.allCount) {
      dom.allCount.textContent = `(${baseProducts.length})`;
    }

    // Ordenar categorías alfabéticamente
    const sortedCategories = Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b));

    // Si la categoría seleccionada ya no existe en el nuevo departamento, volver a 'ALL'
    if (state.selectedCategory !== 'ALL' && !categoryCounts[state.selectedCategory]) {
      state.selectedCategory = 'ALL';
    }

    // Generar chips
    let html = `
      <button class="cat-chip ${state.selectedCategory === 'ALL' ? 'active' : ''}" data-cat="ALL" role="tab" aria-selected="${state.selectedCategory === 'ALL'}">
        <span>Todas</span>
        <span class="cat-count">(${baseProducts.length})</span>
      </button>
    `;

    sortedCategories.forEach(cat => {
      const count = categoryCounts[cat];
      const isSelected = state.selectedCategory === cat;
      html += `
        <button class="cat-chip ${isSelected ? 'active' : ''}" data-cat="${escapeHtml(cat)}" role="tab" aria-selected="${isSelected}">
          <span>${escapeHtml(cat)}</span>
          <span class="cat-count">(${count})</span>
        </button>
      `;
    });

    dom.categoriesContainer.innerHTML = html;
  }

  // =========================================================================
  // FILTRADO DE PRODUCTOS
  // =========================================================================
  function applyFilters() {
    const query = state.searchQuery.toLowerCase().trim();

    state.filteredProducts = allProducts.filter(p => {
      // 1. Filtro Departamento
      if (state.selectedDept !== 'ALL' && p.department !== state.selectedDept) {
        return false;
      }

      // 2. Filtro Categoría
      if (state.selectedCategory !== 'ALL' && p.categoryName !== state.selectedCategory) {
        return false;
      }

      // 3. Filtro Búsqueda
      if (query) {
        const nameMatch = p.name.toLowerCase().includes(query);
        const catMatch = (p.categoryName || '').toLowerCase().includes(query);
        const skuMatch = (p.sku || '').toLowerCase().includes(query);
        const barcodeMatch = (p.barcode || '').toLowerCase().includes(query);
        const variantMatch = (p.variants || []).some(v => 
          v.name.toLowerCase().includes(query) || (v.sku || '').toLowerCase().includes(query)
        );

        if (!nameMatch && !catMatch && !skuMatch && !barcodeMatch && !variantMatch) {
          return false;
        }
      }

      return true;
    });

    // Actualizar contador visible
    if (dom.visibleCount) {
      dom.visibleCount.textContent = state.filteredProducts.length;
    }

    // Actualizar indicador de filtro si está activo
    if (dom.filterIndicator) {
      const activeFilters = [];
      if (state.selectedDept !== 'ALL') {
        activeFilters.push(state.selectedDept === 'CAFE' ? 'Café' : 'Mercado');
      }
      if (state.selectedCategory !== 'ALL') {
        activeFilters.push(state.selectedCategory);
      }
      if (query) {
        activeFilters.push(`"${query}"`);
      }

      if (activeFilters.length > 0) {
        dom.filterIndicator.style.display = 'inline';
        dom.filterIndicator.textContent = `• Filtrado por: ${activeFilters.join(', ')}`;
      } else {
        dom.filterIndicator.style.display = 'none';
      }
    }

    // Resetear contador de renderizado y mostrar productos
    state.renderedCount = 0;
    dom.productsGrid.innerHTML = '';

    if (state.filteredProducts.length === 0) {
      dom.emptyState.style.display = 'block';
    } else {
      dom.emptyState.style.display = 'none';
      renderMoreProducts();
    }
  }

  // =========================================================================
  // RENDERIZADO DE TARJETAS DE PRODUCTOS
  // =========================================================================
  function renderMoreProducts() {
    const total = state.filteredProducts.length;
    if (state.renderedCount >= total) return;

    const nextBatch = state.filteredProducts.slice(state.renderedCount, state.renderedCount + state.pageSize);
    const fragment = document.createDocumentFragment();

    nextBatch.forEach(product => {
      const card = createProductCardElement(product);
      fragment.appendChild(card);
    });

    dom.productsGrid.appendChild(fragment);
    state.renderedCount += nextBatch.length;

    // Si aún quedan más productos, agregar botón "Ver más productos" o detector de scroll
    updateLoadMoreButton();
  }

  function createProductCardElement(product) {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.setAttribute('data-id', product.id);

    const hasVariants = product.variants && product.variants.length > 0;
    const selectedVariantId = state.selectedVariants[product.id] || (hasVariants ? product.variants[0].id : null);
    const currentVariant = hasVariants ? (product.variants.find(v => v.id === selectedVariantId) || product.variants[0]) : null;

    const currentPrice = currentVariant ? currentVariant.price : product.price;
    const isCafe = product.department === 'CAFE';
    const waUrl = generateWhatsAppUrl(product, currentVariant);

    // Badges de Departamento y Categoría
    let badgesHtml = '';
    if (isCafe) {
      badgesHtml += `<span class="badge badge-cafe">☕ Café</span>`;
    } else {
      badgesHtml += `<span class="badge badge-market">🛒 Mercado</span>`;
    }

    if (product.categoryName) {
      badgesHtml += `<span class="badge badge-category">${escapeHtml(product.categoryName)}</span>`;
    }

    // HTML de Variantes si existen
    let variantsHtml = '';
    if (hasVariants) {
      const variantButtons = product.variants.map(v => {
        const isSelected = v.id === currentVariant.id;
        return `
          <button 
            type="button" 
            class="variant-btn ${isSelected ? 'selected' : ''}" 
            data-product-id="${product.id}" 
            data-variant-id="${v.id}"
            title="${escapeHtml(v.name)} - ${formatMoney(v.price)}"
          >
            ${escapeHtml(v.name)}
          </button>
        `;
      }).join('');

      variantsHtml = `
        <div class="variants-container">
          <span class="variants-label">Selecciona opción:</span>
          <div class="variants-list">
            ${variantButtons}
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-top">
        <div class="badge-group">
          ${badgesHtml}
        </div>
      </div>

      <div class="card-body">
        <h3 class="product-name">${escapeHtml(product.name)}</h3>
        ${variantsHtml}
      </div>

      <div class="card-bottom">
        <div class="price-row">
          <span class="price-label">Precio</span>
          <div class="price-value" id="price-${product.id}">
            ${formatMoney(currentPrice)}
            <span class="price-currency">COP</span>
          </div>
        </div>

        <a 
          href="${waUrl}" 
          class="btn-whatsapp" 
          id="wa-btn-${product.id}" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.697c1.002.548 1.83.821 2.806.821h.005c3.18 0 5.767-2.586 5.767-5.766.001-3.182-2.585-5.77-5.767-5.772zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.697.073-1.045-.043-.223-.075-.461-.174-.78-.313-1.354-.59-2.234-1.93-2.302-2.02-.068-.09-1.046-1.391-1.046-2.653 0-1.262.66-1.882.894-2.14.234-.257.51-.322.68-.322.17 0 .34.002.488.01.159.008.371-.06.58.442.213.513.727 1.77.79 1.9.064.13.106.284.021.455-.085.17-.128.277-.255.426-.128.149-.27.332-.385.446-.128.127-.26.265-.112.52.149.255.66 1.09 1.415 1.764.97.865 1.787 1.134 2.042 1.261.255.128.404.106.553-.064.149-.17.638-.745.808-.999.17-.255.34-.213.574-.128.234.085 1.488.702 1.743.83.255.127.425.191.488.3.064.106.064.616-.08 1.021zM12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.175L2 22l4.98-1.306A9.957 9.957 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
          </svg>
          <span>Pedir por WhatsApp</span>
        </a>
      </div>
    `;

    return card;
  }

  // Botón "Cargar Más"
  function updateLoadMoreButton() {
    let existingBtn = document.getElementById('btn-load-more');
    const remaining = state.filteredProducts.length - state.renderedCount;

    if (remaining > 0) {
      if (!existingBtn) {
        existingBtn = document.createElement('div');
        existingBtn.id = 'btn-load-more';
        existingBtn.style.textAlign = 'center';
        existingBtn.style.margin = '32px 0 16px';
        existingBtn.style.gridColumn = '1 / -1';
        dom.productsGrid.parentNode.appendChild(existingBtn);
      }

      existingBtn.innerHTML = `
        <button class="btn-reset" style="padding: 12px 28px; font-size: 0.95rem;">
          Mostrar más productos (${remaining} restantes)
        </button>
      `;

      existingBtn.querySelector('button').onclick = () => {
        renderMoreProducts();
      };
    } else if (existingBtn) {
      existingBtn.remove();
    }
  }

  // =========================================================================
  // GESTIÓN DE EVENTOS & INTERACTIVIDAD
  // =========================================================================
  function setupEventListeners() {
    // 1. Buscador en tiempo real
    let searchTimeout = null;
    dom.searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      state.searchQuery = val;

      if (val.trim().length > 0) {
        dom.searchClear.classList.add('visible');
      } else {
        dom.searchClear.classList.remove('visible');
      }

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        applyFilters();
      }, 150);
    });

    // 2. Limpiar buscador
    dom.searchClear.addEventListener('click', () => {
      dom.searchInput.value = '';
      state.searchQuery = '';
      dom.searchClear.classList.remove('visible');
      dom.searchInput.focus();
      applyFilters();
    });

    // 3. Filtro por Departamento
    dom.deptPills.forEach(pill => {
      pill.addEventListener('click', () => {
        dom.deptPills.forEach(p => {
          p.classList.remove('active');
          p.setAttribute('aria-selected', 'false');
        });
        pill.classList.add('active');
        pill.setAttribute('aria-selected', 'true');

        state.selectedDept = pill.dataset.dept;
        updateCategoryChips();
        applyFilters();
      });
    });

    // 4. Delegación de eventos en contenedor de categorías
    dom.categoriesContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.cat-chip');
      if (!chip) return;

      const cat = chip.dataset.cat;
      state.selectedCategory = cat;

      dom.categoriesContainer.querySelectorAll('.cat-chip').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-selected', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-selected', 'true');

      applyFilters();
    });

    // 5. Delegación de eventos para selección de Variantes en tarjetas
    dom.productsGrid.addEventListener('click', (e) => {
      const variantBtn = e.target.closest('.variant-btn');
      if (!variantBtn) return;

      const productId = variantBtn.dataset.productId;
      const variantId = variantBtn.dataset.variantId;

      const product = allProducts.find(p => p.id === productId);
      if (!product || !product.variants) return;

      const variant = product.variants.find(v => v.id === variantId);
      if (!variant) return;

      // Actualizar estado
      state.selectedVariants[productId] = variantId;

      // Actualizar UI de botones de variante en esa tarjeta
      const card = variantBtn.closest('.product-card');
      if (card) {
        card.querySelectorAll('.variant-btn').forEach(btn => btn.classList.remove('selected'));
        variantBtn.classList.add('selected');

        // Actualizar precio
        const priceElement = card.querySelector(`#price-${productId}`);
        if (priceElement) {
          priceElement.innerHTML = `
            ${formatMoney(variant.price)}
            <span class="price-currency">COP</span>
          `;
        }

        // Actualizar botón WhatsApp
        const waBtn = card.querySelector(`#wa-btn-${productId}`);
        if (waBtn) {
          waBtn.href = generateWhatsAppUrl(product, variant);
        }
      }
    });

    // 6. Botón de restablecer filtros en pantalla vacía
    if (dom.btnResetFilters) {
      dom.btnResetFilters.addEventListener('click', () => {
        state.searchQuery = '';
        state.selectedDept = 'ALL';
        state.selectedCategory = 'ALL';

        dom.searchInput.value = '';
        dom.searchClear.classList.remove('visible');

        dom.deptPills.forEach(pill => {
          const isAll = pill.dataset.dept === 'ALL';
          pill.classList.toggle('active', isAll);
          pill.setAttribute('aria-selected', isAll ? 'true' : 'false');
        });

        updateCategoryChips();
        applyFilters();
      });
    }

    // 7. Carga infinita opcional con IntersectionObserver si el usuario llega al final
    if ('IntersectionObserver' in window) {
      const sentinel = document.createElement('div');
      sentinel.id = 'scroll-sentinel';
      sentinel.style.height = '20px';
      dom.productsGrid.parentNode.appendChild(sentinel);

      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && state.renderedCount < state.filteredProducts.length) {
          renderMoreProducts();
        }
      }, { rootMargin: '300px' });

      observer.observe(sentinel);
    }
  }

  // =========================================================================
  // UTILIDADES
  // =========================================================================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================================
  // ARRANQUE DE LA APLICACIÓN
  // =========================================================================
  function init() {
    initHeaderAndFooter();
    updateCategoryChips();
    applyFilters();
    setupEventListeners();
  }

  // Ejecutar al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
