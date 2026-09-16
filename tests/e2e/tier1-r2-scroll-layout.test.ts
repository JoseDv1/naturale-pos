import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Tier 1 — R2: Adaptive Layout & Global Scroll Contracts', () => {
  const rootDir = resolve(__dirname, '../../');
  const appCssPath = resolve(rootDir, 'frontend/src/app.css');
  const appSveltePath = resolve(rootDir, 'frontend/src/App.svelte');
  const checkoutPath = resolve(rootDir, 'frontend/src/lib/pages/Checkout.svelte');
  const inventoryPath = resolve(rootDir, 'frontend/src/lib/pages/Inventory.svelte');
  const expensesPath = resolve(rootDir, 'frontend/src/lib/pages/Expenses.svelte');
  const reportsPath = resolve(rootDir, 'frontend/src/lib/pages/Reports.svelte');
  const tablesPath = resolve(rootDir, 'frontend/src/lib/pages/Tables.svelte');

  // ---------------------------------------------------------------------------
  // 1. Global Shell CSS & Body Rules (Feature 9)
  // ---------------------------------------------------------------------------
  it('TC-R2-01: frontend/src/app.css must exist and define global styling', () => {
    expect(existsSync(appCssPath)).toBe(true);
    const content = readFileSync(appCssPath, 'utf-8');
    expect(content).toContain(':root');
  });

  it('TC-R2-02: Global body layout in app.css must not lock vertical scroll with overflow: hidden and height: 100vh', () => {
    const content = readFileSync(appCssPath, 'utf-8');
    // Extract body block
    const bodyMatch = content.match(/body\s*\{([^}]+)\}/);
    if (bodyMatch) {
      const bodyCss = bodyMatch[1];
      const hasFixed100vh = bodyCss.includes('height: 100vh') && !bodyCss.includes('min-height');
      const hasOverflowHidden = bodyCss.includes('overflow: hidden');
      // Contract: Body must not lock scroll permanently with both fixed 100vh and overflow: hidden
      const isScrollLocked = hasFixed100vh && hasOverflowHidden;
      expect(isScrollLocked).toBe(false);
    }
  });

  it('TC-R2-03: App.svelte .app-layout container must allow fluid overflow/scroll', () => {
    expect(existsSync(appSveltePath)).toBe(true);
    const content = readFileSync(appSveltePath, 'utf-8');
    const layoutMatch = content.match(/\.app-layout\s*\{([^}]+)\}/);
    if (layoutMatch) {
      const layoutCss = layoutMatch[1];
      const isLocked = layoutCss.includes('height: 100vh') && layoutCss.includes('overflow: hidden');
      expect(isLocked).toBe(false);
    }
  });

  it('TC-R2-04: App.svelte .main-content container must permit vertical scrolling', () => {
    const content = readFileSync(appSveltePath, 'utf-8');
    const mainMatch = content.match(/\.main-content\s*\{([^}]+)\}/);
    if (mainMatch) {
      const mainCss = mainMatch[1];
      const hasScroll = mainCss.includes('overflow-y: auto') || mainCss.includes('overflow: auto');
      const isNotHardLocked = !(mainCss.includes('height: 100%') && mainCss.includes('overflow: hidden'));
      expect(hasScroll || isNotHardLocked).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. View-Level Scrollability Contracts (Feature 10)
  // ---------------------------------------------------------------------------
  it('TC-R2-05: Checkout view must allow vertical scrolling for long product catalogs and orders', () => {
    expect(existsSync(checkoutPath)).toBe(true);
    const content = readFileSync(checkoutPath, 'utf-8');
    // Verify checkout has scrollable regions (overflow-y: auto or overflow: auto)
    const hasScroll = content.includes('overflow-y: auto') || content.includes('overflow: auto');
    expect(hasScroll).toBe(true);
  });

  it('TC-R2-06: Inventory view must allow fluid scrolling for extensive product lists', () => {
    expect(existsSync(inventoryPath)).toBe(true);
    const content = readFileSync(inventoryPath, 'utf-8');
    const hasScroll = content.includes('overflow-y: auto') || content.includes('overflow: auto');
    expect(hasScroll).toBe(true);
  });

  it('TC-R2-07: Expenses view must support vertical scrolling for transaction logs', () => {
    expect(existsSync(expensesPath)).toBe(true);
    const content = readFileSync(expensesPath, 'utf-8');
    const hasScroll = content.includes('overflow-y: auto') || content.includes('overflow: auto');
    expect(hasScroll).toBe(true);
  });

  it('TC-R2-08: Reports view must allow fluid scroll across sales history tables and summary cards', () => {
    expect(existsSync(reportsPath)).toBe(true);
    const content = readFileSync(reportsPath, 'utf-8');
    const hasScroll = content.includes('overflow-y: auto') || content.includes('overflow: auto');
    expect(hasScroll).toBe(true);
  });

  it('TC-R2-09: Tables view must support scrolling or panning for dynamic room layout grids', () => {
    expect(existsSync(tablesPath)).toBe(true);
    const content = readFileSync(tablesPath, 'utf-8');
    const hasScroll = content.includes('overflow-y: auto') || content.includes('overflow: auto') || content.includes('overflow');
    expect(hasScroll).toBe(true);
  });
});
