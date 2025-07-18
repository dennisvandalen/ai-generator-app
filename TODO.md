# Product Base Concept

The "Product Base" serves as a foundational, configurable product in Shopify that acts as a template for AI-generated designs. It defines the core characteristics of a physical product (e.g., a poster, a canvas print, a mug) onto which AI-generated artwork will be applied. This concept is crucial for standardizing product dimensions, material properties, pricing, and ensuring accurate previews and fulfillment.

## Key Components & Functionality:

### 1. Product Base Definition
-   **Purpose:** To provide a standardized template for AI-generated art. This includes defining the physical product type (e.g., "Poster," "Canvas," "T-Shirt").
-   **Core Attributes:**
    -   **Dimensions:** The product base will have predefined dimensions (e.g., 1:1 for square, 2:3 for portrait, 3:2 for landscape) that guide the AI generation process.
    
    -   **Pricing Structure:** Base pricing for the product, which can be adjusted by variants.

### 2. Variant Management (Print Sizes/Physical Options)
-   **Example: Poster Product Base**
    -   This product base would have variants for each available print size, such as:
        -   `A4 Poster` (e.g., 210mm x 297mm, aspect ratio ~1:1.41)
        -   `A3 Poster` (e.g., 297mm x 420mm, aspect ratio ~1:1.41)
        -   `Custom Square` (e.g., 30x30cm, aspect ratio 1:1)
    -   Each variant must explicitly define its corresponding pixel dimensions (e.g., `A4` might map to `2480x3508px` at 300 DPI). The aspect ratio will be calculated from these dimensions when needed.
    -   These dimensions are critical for:
        -   **AI Generation:** Informing the AI model about the target output dimensions.
        -   **Preview Rendering:** Ensuring the AI-generated image is displayed correctly within the product preview on the Product Display Page (PDP).

### 3. Product-Product Base Relationship
-   **Product Base:** A foundational, configurable product template.
-   **Product Base Variants:** Specific configurations of a Product Base (e.g., different sizes for a poster base).
-   **Product Linking:** A Shopify Product can be linked to one or more Product Bases.
-   **Product Variant Linking:** A Shopify Product Variant can be linked to exactly one Product Base Variant. This ensures that each specific product offering (e.g., "My AI Art - A4 Poster") corresponds to a defined physical template.

### 4. AI Generation Integration
-   When a user selects a Shopify Product Variant (e.g., "A4 Poster" for a specific AI-generated product) and triggers AI generation:
    -   The system retrieves the specific dimensions/aspect ratio associated with that variant.
    -   All relevant details, including the Shopify Product ID, Shopify Variant ID, our internal Product Base ID, and the selected style, are posted to the AI generation service.
    -   This information is passed to the AI generation service to produce an image optimized for that output size.
    -   The generated image is then used for the product preview and eventually for fulfillment.

