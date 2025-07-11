/**
 * Page Detection Utilities
 * Migrated from block.liquid JavaScript logic
 */

export function isProductPage(): boolean {
  const href = window.location.href;
  return (
    /.*\.shopifypreview\.com\/products_preview/.test(href) ||
    /\/products\/([A-Za-z0-9-_%]+)(\/)?/.test(href)
  );
}

export function detectPageType(): string {
  return getPageType();
}

export function getPageType(): string {
  if (/\/cart/.test(window.location.href)) return 'cart';
  if (/\/collections\/([A-Za-z0-9-_%]+)/.test(window.location.href)) return 'collection';
  if (isProductPage()) return 'product';
  if (window.location.pathname === '/' || window.location.pathname === '') return 'home';
  return 'other';
}

export function isThemeEditor(): boolean {
  // Check for theme preview domain
  if (window.location.hostname.includes('.shopifypreview.com')) {
    return true;
  }
  
  // Check for preview theme parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('preview_theme_id')) {
    return true;
  }
  
  // Check if we're in an iframe (theme editor loads site in iframe)
  if (window.top !== window.self || window.parent !== window) {
    return true;
  }
  
  // Check for theme editor specific parameters
  if (urlParams.has('_fd') || urlParams.has('_ab')) {
    return true;
  }
  
  // Check for Shopify admin context
  if (document.querySelector('meta[name="shopify-checkout-api-token"]') && 
      (window.location.search.includes('preview') || window.location.search.includes('theme'))) {
    return true;
  }
  
  return false;
}

// Additional utility functions for form integration
export function findAddToCartButton(): HTMLElement | null {
  // Common selectors for add to cart buttons across themes
  const selectors = [
    'button[name="add"]',
    'input[name="add"]',
    '.btn-product-add',
    '.product-form__cart-submit',
    '.product-form__buttons button[type="submit"]',
    '.product-form button[type="submit"]',
    'button[form*="product"]',
    '.add-to-cart',
    '.add-to-cart-button',
    '.product-add',
    '.btn-addtocart',
    '[data-add-to-cart]'
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector) as HTMLElement;
    if (button) {
      // Verify it's actually an add to cart button by checking text content
      const text = button.textContent?.toLowerCase() || '';
      if (text.includes('add') || text.includes('cart') || text.includes('bag') || 
          (button as HTMLInputElement).name === 'add') {
        return button;
      }
    }
  }
  return null;
}

export function findProductForm(): HTMLFormElement | null {
  const addToCartButton = findAddToCartButton();
  if (addToCartButton) {
    // Find the form that contains the add to cart button
    const form = addToCartButton.closest('form') as HTMLFormElement;
    if (form) return form;
  }

  // Fallback selectors
  const selectors = [
    'form[action*="/cart/add"]',
    '#product-form-template',
    '.product-form form'
  ];

  for (const selector of selectors) {
    const form = document.querySelector(selector) as HTMLFormElement;
    if (form) {
      // Verify this form has submission capability
      const hasSubmitButton = form.querySelector('button[type="submit"], input[type="submit"], button[name="add"]');
      if (hasSubmitButton) return form;
    }
  }
  
  return null;
} 