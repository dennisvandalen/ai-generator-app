Absolutely — you can grab the selected Shopify variant ID from the global window object. Here are your best options:

⸻

🔍 1. ShopifyAnalytics.meta.selectedVariantId

Many themes (especially older ones) attach the currently selected variant ID here:

const variantId = window.ShopifyAnalytics?.meta?.selectedVariantId; 
console.log(variantId); // e.g. 1234567890, or undefined if out-of-stock

According to a Slate user on GitHub, this reliably returns the current variant (if available)  ￼.

⸻

🌱 2. In Dawn and similar themes

Dawn’s global.js has an internal function called updateMasterId() that updates the selected variant. You can hook into it or replicate similar logic:
	•	Inspect global.js in your theme
	•	Either override or extend the behavior
	•	Or bind your own listener to variant change events  ￼

⸻

🔄 3. Use the URL

When the page deep-links variants via ?variant=123456, you can extract it:

const params = new URLSearchParams(window.location.search);
const variantId = params.get('variant');

This always grabs the variant shown in the URL  ￼.

⸻

🛠 4. DOM fallback

Themes often render a hidden input <input name="id" value="..."> or embed it in a data attribute like:

<div class="product__pickup-availabilities" data-variant-id="123456">

Then in JS:

const el = document.querySelector('.product__pickup-availabilities');
const variantId = el?.dataset?.variantId;

OR

const variantId = document.querySelector('input[name="id"]').value;
```  [oai_citation:3‡stackoverflow.com](https://stackoverflow.com/questions/48068442/dynamically-pulling-variant-id-via-javascript-using-shopify?utm_source=chatgpt.com) [oai_citation:4‡github.com](https://github.com/Shopify/slate/issues/1035?utm_source=chatgpt.com)

---

### ✅ Summary

- **`window.ShopifyAnalytics.meta.selectedVariantId`** → easy and fast
- **URL param** → reliable for deep-linked variants
- **DOM or theme functions** → fallback for modern themes like Dawn

Use the method that best fits your theme.