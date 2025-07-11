// Form detection and management utilities

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
    'button:contains("Add to cart")',
    'button:contains("Add to bag")',
    '[data-add-to-cart]'
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector) as HTMLElement;
    if (button) {
      // Verify it's actually an add to cart button by checking text content
      const text = button.textContent?.toLowerCase() || '';
      if (text.includes('add') || text.includes('cart') || text.includes('bag') || (button as any).name === 'add') {
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

  // Fallback selectors (prefer forms that actually contain add buttons)
  const selectors = [
    'form:has(button[name="add"])',
    'form:has(input[name="add"])',
    'form:has(.add-to-cart)',
    '#product-form-template',
    '.product-form form',
    'form[action*="/cart/add"]'
  ];

  for (const selector of selectors) {
    try {
      const form = document.querySelector(selector) as HTMLFormElement;
      if (form) {
        // Verify this form has submission capability
        const hasSubmitButton = form.querySelector('button[type="submit"], input[type="submit"], button[name="add"]');
        if (hasSubmitButton) return form;
      }
    } catch (e) {
      // Skip invalid selectors
      continue;
    }
  }
  
  // Last resort - any cart form
  return document.querySelector('form[action*="/cart/add"]') as HTMLFormElement;
}

export function findButtonsContainer(): HTMLElement | null {
  const addToCartButton = findAddToCartButton();
  if (!addToCartButton) return null;

  // Look for a specific buttons container first
  const containerSelectors = [
    '.product-form__buttons',
    '.product-buttons',
    '.cart-buttons',
    '.buy-buttons',
    '.purchase-buttons'
  ];

  for (const selector of containerSelectors) {
    const container = document.querySelector(selector) as HTMLElement;
    if (container && container.contains(addToCartButton)) {
      return container;
    }
  }

  // More conservative fallback: look for immediate parent with multiple buttons
  let parent = addToCartButton.parentElement;
  let attempts = 0;
  while (parent && parent !== document.body && attempts < 3) {
    const buttons = parent.querySelectorAll('button[type="submit"], input[type="submit"], button[name="add"]');
    if (buttons.length >= 1 && parent.offsetHeight < 200) { // Height limit to avoid large containers
      return parent;
    }
    parent = parent.parentElement;
    attempts++;
  }

  // Last resort: just cover the button itself
  return addToCartButton;
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function addHiddenFields(generationState: any): void {
  const form = findProductForm();
  if (!form) {
    console.log('⚠️ Product form not found for hidden fields');
    return;
  }

  console.log('✅ Adding fields to form:', form.id || 'no-id', form);

  // Remove existing AI fields if any
  const existingFields = form.querySelectorAll('input[name^="ai_"], input[name^="properties[ai_"]');
  if (existingFields.length > 0) {
    console.log('🔄 Removing', existingFields.length, 'existing AI fields');
    existingFields.forEach(field => field.remove());
  }

  // Only add fields if generation is selected
  if (generationState.generationSelected && generationState.generationId) {
    // Line item property for cart display (shows in cart/checkout)
    const lineItemField = document.createElement('input');
    lineItemField.type = 'hidden';
    lineItemField.name = 'properties[AI Generation ID]';
    lineItemField.value = generationState.generationId;
    form.appendChild(lineItemField);

    // Internal tracking field (for form validation)
    const trackingField = document.createElement('input');
    trackingField.type = 'hidden';
    trackingField.name = 'ai_generation_selected';
    trackingField.value = 'true';
    form.appendChild(trackingField);

    console.log('✅ Added AI line item property:', {
      lineItemProperty: 'AI Generation ID = ' + generationState.generationId,
      tracking: 'ai_generation_selected = true'
    });
  } else {
    // Just tracking field when no generation selected
    const trackingField = document.createElement('input');
    trackingField.type = 'hidden';
    trackingField.name = 'ai_generation_selected';
    trackingField.value = 'false';
    form.appendChild(trackingField);

    console.log('✅ Added AI tracking field (no generation selected)');
  }
}

export function createButtonsOverlay(): void {
  const container = findButtonsContainer();
  if (!container) {
    console.log('⚠️ Buttons container not found');
    return;
  }

  // Remove existing overlay
  const existingOverlay = document.getElementById('ai-buttons-overlay');
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ai-buttons-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.05);
    backdrop-filter: blur(1px);
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    cursor: not-allowed;
    pointer-events: auto;
  `;

  overlay.innerHTML = `
    <div style="
      background: rgba(255, 255, 255, 0.95);
      padding: 8px 12px;
      border-radius: 4px;
      text-align: center;
      font-size: 12px;
      color: #666;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      white-space: nowrap;
    ">
      🎨 Select AI first
    </div>
  `;

  // Make container relative if it's not already
  const computedStyle = window.getComputedStyle(container);
  if (computedStyle.position === 'static') {
    container.style.position = 'relative';
  }

  container.appendChild(overlay);
  console.log('✅ Buttons overlay created');
}

export function removeButtonsOverlay(): void {
  const overlay = document.getElementById('ai-buttons-overlay');
  if (overlay) {
    overlay.remove();
    console.log('✅ Buttons overlay removed');
  }
}

export function updateGenerationState(
  generationSelected: boolean, 
  generationId: string | null = null
): any {
  const generationState = {
    generationSelected,
    generationId,
    isInitialized: true
  };

  // Store globally for debugging
  (window as any).__aiGenerationState = generationState;

  // Update hidden fields
  addHiddenFields(generationState);

  // Update button overlay
  if (generationSelected) {
    removeButtonsOverlay();
  } else {
    createButtonsOverlay();
  }

  // Dispatch custom event to notify React components immediately
  window.dispatchEvent(new CustomEvent('aiGenerationStateChanged', {
    detail: generationState
  }));

  console.log('🔄 Generation state updated:', generationState);
  
  return generationState;
} 