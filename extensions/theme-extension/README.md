# AI Generator Theme Extension

This theme extension provides debug information and will eventually include the AI generation SDK.

## Current Features

### AI Placeholder Widget

When AI is enabled for a product, an AI generation widget appears above the product form.

**Live Store Widget Features:**
- Gradient background with subtle texture
- "AI Art Generation Available!" message  
- Interactive button: "🎨 Generate AI Art" / "🔄 Change Generation"
- Status badge: "🚀 Select AI Style" / "✅ Generation Selected"
- State management with fake generation selection
- Positioned above product form
- Full form manipulation and button overlay functionality

**Theme Editor Widget Features:**
- Same beautiful gradient background and visual design
- "AI Art Generation Available!" message
- Non-interactive preview with "🎨 Theme Editor Preview" badge
- "🚀 Interactive on Live Store" status indicator
- Clean notification-only display for merchant preview
- No form manipulation or button interactions

### Add to Cart Protection

When no AI generation is selected, the add to cart and buy buttons are disabled with a targeted overlay.

**Protection Features:**
- Lightweight overlay covers only the buttons area
- Compact "🎨 Select AI first" message
- Subtle blur effect and visual feedback
- Automatically removed when generation is selected
- Smart button container detection with size limits to avoid large overlays

### Debug Information Display

The theme extension shows a debug information panel in the bottom-right corner of pages with AI-related data.

**Debug Panel Contents:**
- **Theme Editor status** (🎨 YES for theme editor, 🌐 LIVE for storefront)
- Page type (product, cart, collection, home, other)
- Product ID (if on product page)
- AI status (enabled/disabled/not set)
- Generation selected state (live updates)
- Generation ID (live updates)
- **Line item status** (will show in cart / not set)
- Shop-level settings (enable for all pages, cart, collection)
- Last updated timestamp

**Auto-hide Behavior:**
- Appears for 10 seconds, then auto-hides
- Stays visible when hovered
- Can be manually closed with × button
- Only shows on relevant pages (product pages or when shop settings are active)

### Form Integration

Simple hidden fields are automatically added to the product form when AI is enabled:

**Line Item Properties (visible in cart/checkout):**
- `properties[AI Generation ID]`: UUID string - shows in cart as line item property
- Only added when generation is actually selected

**Internal Tracking Fields:**
- `ai_generation_selected`: "true" or "false" - tracks selection state for form validation

**Form Detection:**
- Finds the exact form containing the add to cart button using `closest('form')`
- Fallback selectors for various theme structures
- Verifies form has actual submission capability
- Only adds line item property when generation is selected
- Generation ID appears in cart/checkout as custom product property
- Clean, minimal approach focused on cart visibility

### Theme Editor Detection

Automatically detects when the theme is being viewed in the Shopify theme editor/customizer.

**Detection Methods:**
- `.shopifypreview.com` domain check
- `preview_theme_id` URL parameter
- iframe detection (theme editor loads site in iframe)
- Theme editor specific parameters (`_fd`, `_ab`)
- Shopify admin context indicators

**Theme Editor Behavior:**
- AI functionality is enabled on all product pages for demo purposes
- **Shows notification-only widget** instead of interactive version
- Clean preview with "🎨 Theme Editor Preview" and "🚀 Interactive on Live Store" badges
- Special console logging: "🎨 AI GENERATION ENABLED (THEME EDITOR DEMO)"
- Debug panel shows "🎨 YES" for theme editor mode
- No interactive buttons or form manipulation in theme editor
- Allows merchants to preview AI visual appearance during theme customization

### Console Logging

Detailed console output including:
- **Theme editor detection status**
- Product information
- AI enablement status
- Page type detection
- Add to cart button detection
- Form and button container detection
- **Enhanced form detection** (which form is being used, form IDs)
- Generation state changes
- Line item property status updates
- Full configuration data

## Files

- `blocks/block.liquid` - Main theme extension block with debug script
- `assets/ai-generator.js` - Placeholder SDK file (not currently loaded)
- `shopify.extension.toml` - Extension configuration

## Metafields Used

### Product Metafields
```
Namespace: "__aiConverterV1"
- ai_enabled: boolean - Whether AI is enabled for this product
- last_updated: string - Last update timestamp
```

### Shop Metafields (Future)
```
Namespace: "__aiConverterV1"
- enable_for_all_pages: boolean - Load on all pages
- enable_on_cart: boolean - Load on cart pages  
- enable_on_collection: boolean - Load on collection pages
```

## Future SDK Integration

When ready to include the actual AI SDK:

1. **Option 1: Include in Extension**
   - Build SDK to `assets/ai-generator.js`
   - Load script tag in `block.liquid`:
   ```liquid
   {{ 'ai-generator.js' | asset_url | script_tag }}
   ```

2. **Option 2: External Loading**
   - Host SDK on external CDN
   - Conditionally load based on AI settings
   - Update debug script to include SDK loading logic

## Development

The debug panel helps verify:
- Metafields are set correctly
- Page detection is working
- Configuration is being read properly
- Shop-level settings are applied
- Theme editor detection is working

**Global Variables Available:**
- `window.__aiConverterV1` - All AI converter metafield data
- `window.__aiGenerationState` - Current generation state
- `window.__isThemeEditor` - Boolean indicating theme editor mode

## Testing

### Live Store Testing
1. Enable AI for a product via the admin app
2. Visit the product page
3. **Verify AI placeholder appears above the product form (or add to cart button)**
4. **Verify add to cart buttons are disabled with a small overlay initially**
5. **Click "🎨 Generate AI Art" button**
6. **Verify overlay disappears and add to cart becomes available**
7. **Verify button changes to "🔄 Change Generation" and badge shows "✅ Generation Selected"**
8. **Click "🔄 Change Generation" to reset state**
9. Check console for debug output (form detection, button detection, state changes)
10. Verify debug panel shows live generation state updates
11. Inspect form to see line item property `properties[AI Generation ID]` when generation selected
12. Test auto-hide and close functionality of debug panel
13. Test on different themes to ensure button/form detection works
14. Add product to cart and verify line item property appears in cart

### Theme Editor Testing
1. **Open Shopify theme editor/customizer**
2. **Navigate to any product page**
3. **Verify debug panel shows "🎨 YES" for theme editor**
4. **Verify AI notification widget appears (not interactive version)**
5. **Check for "🎨 Theme Editor Preview" and "🚀 Interactive on Live Store" badges**
6. **Verify no interactive buttons or form manipulation**
7. **Check console for "🎨 AI GENERATION ENABLED (THEME EDITOR DEMO)" message**
8. **Verify clean visual preview for merchant customization**

### Expected Behavior

**Initial State (No Generation Selected):**
- AI widget shows "🎨 Generate AI Art" button
- Status badge shows "🚀 Select AI Style"
- Add to cart buttons are disabled with overlay
- Hidden fields: `ai_generation_selected` = "false" only
- Console shows: "✅ Added AI tracking field (no generation selected)"

**After Clicking Generate:**
- AI widget shows "🔄 Change Generation" button
- Status badge shows "✅ Generation Selected" (green)
- Add to cart buttons are enabled (overlay removed)
- Hidden fields populated with:
  - `properties[AI Generation ID]` = random UUID (line item property)
  - `ai_generation_selected` = "true" (internal tracking)
- Console shows: "🎨 Fake generation selected: [uuid]"
- Debug panel shows "Line Item: will show in cart" 