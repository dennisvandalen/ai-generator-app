import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ProductData, ProductStyle } from '../../shared/api/productData';
import { ProductDataAPI } from '../../shared/api/productData';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import ReactDOM from 'react-dom';
import { AIGeneratorAPI } from '../../extension/api/client';
import { useTranslations } from '../utils/i18n';

interface ProductAIGeneratorProps {
  productId: string | number;
  shop?: string;
  onGenerationStart?: (style: ProductStyle, selectedImageUrl: string) => void;
  onError?: (error: string) => void;
  onUpdateGenerationState: (
    generationSelected: boolean,
    generationId: string | null,
    imageUrl: string | null
  ) => void;
}

export const ProductAIGenerator: React.FC<ProductAIGeneratorProps> = ({
  productId,
  shop,
  onGenerationStart,
  onError,
  onUpdateGenerationState,
}) => {
  // Get translations
  const t = useTranslations();
  
  // Performance monitoring - track renders
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());

  // Increment render count on each render
  renderCountRef.current += 1;

  // Calculate time since last render
  const now = Date.now();
  const timeSinceLastRender = now - lastRenderTimeRef.current;
  lastRenderTimeRef.current = now;

  // Log render information
  console.log(`🔄 ProductAIGenerator render #${renderCountRef.current} (${timeSinceLastRender}ms since last render)`);

  const [productData, setProductData] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<ProductStyle | null>(null);

  // Generation state
  const [generationState, setGenerationState] = useState({
    generationSelected: false,
    generationId: null as string | null,
    isInitialized: false,
  });

  // Image upload + crop state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);

  // Modal state
  const [showCropperModal, setShowCropperModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Uploaded image URL state
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  // Use useRef to maintain a stable reference to the API instance
  const apiRef = useRef<AIGeneratorAPI>(new AIGeneratorAPI());

  // Generation loading and result state
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationResult, setGenerationResult] = useState<Array<{
    success: boolean;
    generations?: { generationId: string; imageUrl: string }[];
    processingTimeMs?: number;
    prompt?: string;
    styleId?: string;
    styleName?: string;
    inputImageUrl?: string;
    message?: string;
    error?: string;
  }> | null>(null);
  const [selectedGeneratedImageUrl, setSelectedGeneratedImageUrl] = useState<string | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  const loadingMessages = t.loadingMessages;
  const [currentLoadingMessageIndex, setCurrentLoadingMessageIndex] = useState(0);

  const generationsContainerRef = useRef<HTMLDivElement>(null);

  // Get current variant for display - moved to top level to ensure consistent hook order
  // Using refs instead of state to prevent re-renders when variant changes
  const currentVariantIdRef = useRef<string | null>(null);
  const variantAspectRatioRef = useRef<number | null>(null);

  // Keep state for initial render and for components that need to react to changes
  // but don't update these directly when variant changes
  const [currentVariantId, setCurrentVariantId] = useState<string | null>(null);
  const [variantAspectRatio, setVariantAspectRatio] = useState<number | null>(null);

  // Function to calculate aspect ratio based on variant ID - memoized to prevent recalculation
  const calculateAspectRatio = useCallback((variantId: string | null) => {
    if (!variantId || !productData?.variants || productData.variants.length === 0) {
      return null; // Default to null if no variant selected or no variant data
    }

    // Find the variant dimensions
    const variantData = productData.variants.find(v => v.variantId === variantId);
    if (!variantData || !variantData.dimensions) {
      console.log('No dimensions found for variant:', variantId);
      return null;
    }

    const { width, height } = variantData.dimensions;
    if (!width || !height) {
      console.log('Invalid dimensions for variant:', variantId, width, height);
      return null;
    }

    // Calculate aspect ratio (width / height)
    const ratio = width / height;
    console.log('Calculated aspect ratio for variant:', variantId, ratio);
    return ratio;
  }, [productData]);

  // Function to update aspect ratio without triggering re-renders
  const updateAspectRatio = useCallback((variantId: string | null) => {
    const ratio = calculateAspectRatio(variantId);

    // Always update the ref
    currentVariantIdRef.current = variantId;
    variantAspectRatioRef.current = ratio;

    // Only update state if this is the initial setup or if UI needs to be updated
    // This prevents unnecessary re-renders when variant changes
    if (!variantAspectRatio || ratio !== variantAspectRatio) {
      console.log('🔄 Updating aspect ratio state:', variantId, 'New ratio:', ratio);
      setVariantAspectRatio(ratio);
    }

    return ratio;
  }, [calculateAspectRatio, variantAspectRatio]);

  // Initial aspect ratio calculation - runs when product data or currentVariantId changes
  useEffect(() => {
    if (productData?.variants && productData.variants.length > 0) {
      const variantId = currentVariantIdRef.current || currentVariantId;
      updateAspectRatio(variantId);
    }
  }, [productData, updateAspectRatio, currentVariantId]);

  // Define loadProductData with useCallback - removed currentVariantId dependency
  const loadProductData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const api = new ProductDataAPI(shop || (window as any).Shopify?.shop);
      const data = await api.getProductData(productId);

      if (data.error) {
        setError(data.error);
      } else {
        setProductData(data);

        // Auto-select first style if available
        if (data.styles && data.styles.length > 0) {
          setSelectedStyle(data.styles[0]);
        }

        // Note: We don't calculate aspect ratio here anymore
        // The useEffect that depends on productData will handle this
        // This prevents re-fetching data when only the variant changes
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load product data';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [productId, shop, onError]);

  // Helper function to detect the currently selected variant
  // Optimized to avoid unnecessary re-renders
  const getSelectedVariantId = (): string | null => {
    try {
      // For performance logging
      const startTime = performance.now();

      // Method 1: Check URL parameters
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const variantFromUrl = params.get('variant');
        if (variantFromUrl) {
          console.log('✅ Found variant ID via URL params:', variantFromUrl);
          return variantFromUrl;
        }
      }

      // Look for the product form in the current page
      const productForm = document.querySelector('form[action*="/cart/add"]') as HTMLFormElement;
      if (!productForm) {
        console.warn('Product form not found');
        return null;
      }

      // Method 2: Look for the variant ID input field
      const variantInput = productForm.querySelector('input[name="id"]') as HTMLInputElement;
      if (variantInput && variantInput.value) {
        const variantId = variantInput.value;
        console.log('✅ Found variant ID via input[name="id"]:', variantId);
        return variantId;
      }

      // Method 3: Horizon theme support - Look for checked radio inputs with data-variant-id
      const checkedRadios = productForm.querySelectorAll('input[type="radio"]:checked[data-variant-id]') as NodeListOf<HTMLInputElement>;
      if (checkedRadios.length > 0) {
        // Get the variant ID from the last checked radio (in case of multiple option sets)
        const lastCheckedRadio = checkedRadios[checkedRadios.length - 1];
        const variantId = lastCheckedRadio.getAttribute('data-variant-id');
        if (variantId) {
          console.log('✅ Found variant ID via Horizon theme checked radio data-variant-id:', variantId);
          return variantId;
        }
      }

      // Method 4: Look for any input with class containing "product-variant-id"
      const variantInputByClass = productForm.querySelector('input[class*="product-variant-id"]') as HTMLInputElement;
      if (variantInputByClass && variantInputByClass.value) {
        const variantId = variantInputByClass.value;
        console.log('✅ Found variant ID via class selector:', variantId);
        return variantId;
      }

      // Method 5: Look for checked radio buttons or selected options (value-based detection)
      const variantSelectors = productForm.querySelectorAll('input[type="radio"], input[type="checkbox"], select');
      for (const selector of variantSelectors) {
        if (selector instanceof HTMLInputElement && selector.checked && selector.value && /^\d+$/.test(selector.value)) {
          const variantId = selector.value;
          console.log('✅ Found variant ID via checked input value:', variantId);
          return variantId;
        } else if (selector instanceof HTMLSelectElement && selector.value && /^\d+$/.test(selector.value)) {
          const variantId = selector.value;
          console.log('✅ Found variant ID via select value:', variantId);
          return variantId;
        }
      }

      // Method 6: Look for data attributes on active/selected elements
      const variantElements = productForm.querySelectorAll('[data-variant-id], [data-variant], [data-product-variant]');
      for (const element of variantElements) {
        const variantId = element.getAttribute('data-variant-id') ||
                         element.getAttribute('data-variant') ||
                         element.getAttribute('data-product-variant');
        if (variantId && (element.classList.contains('selected') || element.classList.contains('active') || 
                         (element as HTMLInputElement).checked)) {
          console.log('✅ Found variant ID via data attribute on active element:', variantId);
          return variantId;
        }
      }

      // Method 7: Fallback - Look for form input value directly (some themes store it differently)
      const directFormInput = document.querySelector('form[action="/cart/add"] input[name="id"]') as HTMLInputElement;
      if (directFormInput && directFormInput.value) {
        const variantId = directFormInput.value;
        console.log('✅ Found variant ID via direct form input fallback:', variantId);
        return variantId;
      }

      // Method 8: Look for any element with variant ID in its attributes (broad search)
      const allElements = productForm.querySelectorAll('*');
      for (const element of allElements) {
        const attributes = element.attributes;
        for (let i = 0; i < attributes.length; i++) {
          const attr = attributes[i];
          if (attr.name.includes('variant') && attr.value && /^\d+$/.test(attr.value)) {
            const variantId = attr.value;
            console.log('✅ Found variant ID via attribute search:', variantId);
            return variantId;
          }
        }
      }

      console.warn('❌ No variant ID found in product form');

      // Log performance
      const endTime = performance.now();
      console.log(`⏱️ Variant detection took ${(endTime - startTime).toFixed(2)}ms`);

      return null;
    } catch (error) {
      console.error('Error detecting selected variant:', error);
      return null;
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (generationLoading) {
      interval = setInterval(() => {
        setCurrentLoadingMessageIndex((prevIndex) =>
          (prevIndex + 1) % loadingMessages.length
        );
      }, 2000); // Change message every 2 seconds
    } else {
      setCurrentLoadingMessageIndex(0); // Reset when not loading
    }
    return () => clearInterval(interval);
  }, [generationLoading, loadingMessages.length]);

  useEffect(() => {
    if (generationsContainerRef.current) {
      generationsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [generationResult]);

  useEffect(() => {
    loadProductData();
  }, [productId, loadProductData]);

  // Listen for variant changes and update generation state
  useEffect(() => {
    // Performance-optimized variant change handler
    const handleVariantChange = () => {
      // Track when this handler is called for performance monitoring
      const handlerStartTime = performance.now();
      console.log('🔄 Variant change detected!');

      // Get the new variant ID
      const newVariantId = getSelectedVariantId();

      // Only proceed if the variant has actually changed
      if (newVariantId !== currentVariantIdRef.current) {
        console.log('🔄 Variant ID updated in event handler:', currentVariantIdRef.current, '→', newVariantId);

        // Update the ref immediately (doesn't cause re-render)
        currentVariantIdRef.current = newVariantId;

        // Store variant ID globally for debug panel
        (window as any).__aiCurrentVariantId = newVariantId;

        // Dispatch custom event for debug panel
        window.dispatchEvent(new CustomEvent('aiVariantIdChanged', {
          detail: { variantId: newVariantId }
        }));

        // Update the aspect ratio using our optimized function (updates refs first)
        const newRatio = updateAspectRatio(newVariantId);

        // Log the optimization
        console.log(`⚡ Optimized variant change: Updated refs without re-render. Aspect ratio: ${newRatio || 'default'}`);

        // Only update state if necessary for UI updates
        // This is done with a slight delay to batch potential state updates
        setTimeout(() => {
          console.log(`⏱️ Delayed state update for variant ${newVariantId}`);
          setCurrentVariantId(newVariantId);
        }, 0);

        // Log total handler execution time
        const handlerEndTime = performance.now();
        console.log(`⏱️ Variant change handler took ${(handlerEndTime - handlerStartTime).toFixed(2)}ms`);

        // If we have a generation selected, we need to reset it when variant changes
        // since the variant affects the generation context
        if (generationState.generationSelected) {
          console.log('Variant changed, resetting generation state');
          onUpdateGenerationState(false, null, null);
          setSelectedGeneratedImageUrl(null);
          setGenerationState(prev => ({ ...prev, generationSelected: false, generationId: null }));
        }
      }
    };

    // More comprehensive variant change detection
    const setupVariantListeners = () => {
      const productForm = document.querySelector('form[action*="/cart/add"]');
      if (!productForm) {
        console.log('⚠️ Product form not found for variant listeners');
        return;
      }

      console.log('🔍 Setting up variant change listeners...');

      // Method 1: Direct input changes
      const variantInputs = productForm.querySelectorAll('input[name="id"], input[type="radio"], input[type="checkbox"], select');
      console.log('Found variant inputs:', variantInputs.length);
      variantInputs.forEach(input => {
        input.addEventListener('change', handleVariantChange);
        input.addEventListener('click', handleVariantChange);
      });

      // Method 2: Listen for any input changes in the form
      productForm.addEventListener('change', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
          console.log('Form input changed:', target);
          handleVariantChange();
        }
      });

      // Method 3: Listen for clicks on variant buttons/options (including Horizon theme)
      const variantButtons = productForm.querySelectorAll('button, .variant-option, [data-variant-id], .variant-option__button-label');
      console.log('Found variant buttons:', variantButtons.length);
      variantButtons.forEach(button => {
        button.addEventListener('click', handleVariantChange);
      });

      // Method 4: Horizon theme specific - listen for variant-picker events
      const variantPicker = document.querySelector('variant-picker');
      if (variantPicker) {
        console.log('🎯 Found Horizon theme variant-picker, setting up listeners');
        variantPicker.addEventListener('change', handleVariantChange);
        variantPicker.addEventListener('input', handleVariantChange);
        
        // Also listen for changes within the variant picker
        const variantPickerForm = variantPicker.querySelector('form');
        if (variantPickerForm) {
          variantPickerForm.addEventListener('change', handleVariantChange);
        }
      }

      // Method 5: MutationObserver to watch for dynamic changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' &&
              (mutation.attributeName === 'value' || mutation.attributeName === 'checked')) {
            console.log('Mutation detected:', mutation);
            handleVariantChange();
          }
        });
      });

      // Observe the entire form for attribute changes
      observer.observe(productForm, {
        attributes: true,
        attributeFilter: ['value', 'checked'],
        subtree: true
      });

      // Method 6: Listen for custom events that themes might dispatch
      document.addEventListener('variant:change', handleVariantChange);
      document.addEventListener('variantChange', handleVariantChange);
      document.addEventListener('product:variant:change', handleVariantChange);
      // Horizon theme might use different event names
      document.addEventListener('variant:updated', handleVariantChange);
      document.addEventListener('product:variant:updated', handleVariantChange);

      // Method 7: Listen for URL changes (for ?variant= parameter detection)
      window.addEventListener('popstate', handleVariantChange);
      window.addEventListener('hashchange', handleVariantChange);
      
      // Also listen for programmatic URL changes (some themes use history.pushState)
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function(...args) {
        originalPushState.apply(history, args);
        setTimeout(handleVariantChange, 0); // Async to ensure URL is updated
      };
      
      history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        setTimeout(handleVariantChange, 0); // Async to ensure URL is updated
      };

      // Return cleanup function
      return () => {
        variantInputs.forEach(input => {
          input.removeEventListener('change', handleVariantChange);
          input.removeEventListener('click', handleVariantChange);
        });
        variantButtons.forEach(button => {
          button.removeEventListener('click', handleVariantChange);
        });
        if (variantPicker) {
          variantPicker.removeEventListener('change', handleVariantChange);
          variantPicker.removeEventListener('input', handleVariantChange);
          const variantPickerForm = variantPicker.querySelector('form');
          if (variantPickerForm) {
            variantPickerForm.removeEventListener('change', handleVariantChange);
          }
        }
        document.removeEventListener('variant:change', handleVariantChange);
        document.removeEventListener('variantChange', handleVariantChange);
        document.removeEventListener('product:variant:change', handleVariantChange);
        document.removeEventListener('variant:updated', handleVariantChange);
        document.removeEventListener('product:variant:updated', handleVariantChange);
        
        // Remove URL change listeners
        window.removeEventListener('popstate', handleVariantChange);
        window.removeEventListener('hashchange', handleVariantChange);
        
        // Restore original history methods
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
        
        observer.disconnect();
      };
    };

    // Setup listeners with a small delay to ensure DOM is ready
    const cleanup = setupVariantListeners();

    // Also setup listeners again after a delay to catch any dynamic content
    const timeoutId = setTimeout(setupVariantListeners, 1000);

    return () => {
      cleanup?.();
      clearTimeout(timeoutId);
    };
  }, [generationState.generationSelected, onUpdateGenerationState, updateAspectRatio]);

  // Update variant ID on mount and provide manual trigger
  useEffect(() => {
    const updateVariantId = () => {
      const newVariantId = getSelectedVariantId();
      setCurrentVariantId(prevVariantId => {
        if (newVariantId !== prevVariantId) {
          console.log('🔄 Variant ID updated:', prevVariantId, '→', newVariantId);
          // Store variant ID globally for debug panel
          (window as any).__aiCurrentVariantId = newVariantId;
          // Dispatch custom event for debug panel
          window.dispatchEvent(new CustomEvent('aiVariantIdChanged', {
            detail: { variantId: newVariantId }
          }));
          return newVariantId;
        }
        return prevVariantId;
      });
    };

    // Initial check
    updateVariantId();

    // Add manual trigger to window for debugging
    (window as any).__forceVariantCheck = updateVariantId;

    return () => {
      delete (window as any).__forceVariantCheck;
    };
  }, []); // No dependencies - runs only once on mount


  const handleGenerationToggle = async () => {
    if (generationState.generationSelected) {
      // Reset state (change generation)
      onUpdateGenerationState(false, null, null);
      setSelectedGeneratedImageUrl(null); // Clear selected generated image
    } else {
      // Ensure we have a style and uploaded image URL
      const style = selectedStyle;
      const imageUrl = uploadedImageUrl || (typeof window !== 'undefined' ? (window as any).__aiUploadedImageUrl : null);
      if (!style) {
        setError(t.selectStyleToContinue);
        return;
      }
      if (!imageUrl) {
        setError(t.uploadImageToContinue);
        return;
      }
      setGenerationLoading(true);
      setError(null);
      try {
        // Use the ref value first if available, otherwise get the current variant ID
        // This prevents unnecessary DOM operations if we already know the variant ID
        const selectedVariantId = currentVariantIdRef.current || getSelectedVariantId();
        console.log('Selected variant ID for generation:', selectedVariantId);

        const result = await apiRef.current.createAIGeneration({
          styleId: style.id,
          imageUrl,
          productId: productId, // Pass productId
          variantId: selectedVariantId || undefined, // Pass the selected variant ID (convert null to undefined)
        });
        setGenerationResult(prevResults => [...(prevResults || []), result]);
        let initialSelectedImageUrl = null;
        if (result.generations && result.generations.length > 0) {
          initialSelectedImageUrl = result.generations[0].imageUrl;
          setSelectedGeneratedImageUrl(initialSelectedImageUrl); // Select the first image by default
          onUpdateGenerationState(true, result.generations[0].generationId, initialSelectedImageUrl);
        } else {
          onUpdateGenerationState(false, null, null); // No images generated, disable ATC
        }
        if (selectedStyle && initialSelectedImageUrl) {
          onGenerationStart?.(selectedStyle, initialSelectedImageUrl);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t.generateAiArt.replace('🎨 ', ''));
        onUpdateGenerationState(false, null, null); // Fix: Add missing third parameter
      } finally {
        setGenerationLoading(false);
      }
    }
  };

  const handleImageSelection = (imageUrl: string, generationId: string) => {
    setSelectedGeneratedImageUrl(imageUrl);
    onUpdateGenerationState(true, generationId, imageUrl);
  };

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Helper to convert blob URL to base64
  async function blobUrlToBase64(blobUrl: string): Promise<string> {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Utility: crop image to max 2048px on the longest side, preserving crop aspect ratio
  const getCroppedImg = useCallback(async (imageSrc: string, crop: any): Promise<string> => {
    const image = await createImage(imageSrc);
    // Calculate aspect ratio from crop area
    const aspect = crop.width / crop.height;

    // Log the aspect ratio being used for cropping
    console.log('🖼️ Cropping image with aspect ratio:', aspect);
    console.log('🖼️ Current variant aspect ratio:', variantAspectRatio);
    console.log('🖼️ Crop dimensions:', crop.width, 'x', crop.height);

    const maxSide = 2048;
    let outputWidth: number, outputHeight: number;
    if (aspect >= 1) {
      // Landscape or square
      outputWidth = maxSide;
      outputHeight = Math.round(maxSide / aspect);
    } else {
      // Portrait
      outputHeight = maxSide;
      outputWidth = Math.round(maxSide * aspect);
    }

    console.log('🖼️ Output dimensions:', outputWidth, 'x', outputHeight);

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');
    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      outputWidth,
      outputHeight
    );
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        resolve(URL.createObjectURL(blob));
      }, 'image/jpeg');
    });
  }, [variantAspectRatio]);

  const showCroppedImage = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsUploading(true); // Set loading to true
    try {
      const cropped = await getCroppedImg(imageSrc, croppedAreaPixels);
      setCroppedImage(cropped);
      // Immediately upload after cropping
      if (cropped) {
        try {
          const base64 = await blobUrlToBase64(cropped);
          const filename = `ai-art-${productId}-${Date.now()}.jpg`;
          const url = await apiRef.current.uploadImage(base64, filename);
          setUploadedImageUrl(url);
          // Store on window for now
          if (typeof window !== 'undefined') {
            (window as any).__aiUploadedImageUrl = url;
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : t.uploading);
        } finally {
          setIsUploading(false); // Set loading to false after upload attempt
        }
      } else {
        setIsUploading(false); // Set loading to false if no cropped image
      }
    } catch (e) {
      setError(t.cropImage);
      setIsUploading(false); // Set loading to false on crop error
    }
  }, [imageSrc, croppedAreaPixels, productId, getCroppedImg]);

  const onFileChange = async (file: File) => {
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result as string);
        setCroppedImage(null);
        setShowCropperModal(true);
      });
      reader.readAsDataURL(file);
    }
  };


  function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new window.Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });
  }

  if (loading) {
    return (
      <div className="ai-generator-loading">
        <div className="ai-generator-spinner"></div>
        <p>{t.loadingAiOptions}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-generator-error">
        <p>{t.error}: {error}</p>
        <button onClick={loadProductData}>{t.retry}</button>
      </div>
    );
  }

  if (!productData?.enabled) {
    return (
      <div className="ai-generator-disabled">
        <p>{productData?.message || t.notAvailable}</p>
      </div>
    );
  }

  const { styles = [] } = productData;

  // Cropper modal as portal
  const cropperModal = showCropperModal && imageSrc ? ReactDOM.createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.6)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <style>{`
        .reactEasyCrop_CropArea {
          display: block !important;
        }
        .reactEasyCrop_CropArea svg line {
          stroke: #3498db !important;
          stroke-width: 2 !important;
          opacity: 1 !important;
        }
      `}</style>
      <div className="ai-generator-cropper-modal-content" style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 4px 32px rgba(0,0,0,0.18)', minWidth: 340, maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }}>
        <style>{`
          @media (max-width: 768px) {
            .ai-generator-cropper-modal-content {
              width: 100vw !important;
              height: 100vh !important;
              max-width: 100vw !important;
              max-height: 100vh !important;
              border-radius: 0 !important;
              padding: 16px !important;
            }
          }
        `}</style>
        <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 12 }}>{t.cropImage}</div>
        <div style={{ position: 'relative', width: 340, height: 340, background: '#eee', margin: '0 auto' }}>
          {/* Use variant aspect ratio if available, otherwise fallback to default */}
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={variantAspectRatioRef.current || variantAspectRatio || 210/297}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            showGrid={true}
            disableAutomaticStylesInjection={true}
          />
        </div>
        <div style={{ margin: '18px 0 0 0', textAlign: 'center' }}>
          <label style={{ fontSize: 13, marginRight: 8 }}>{t.zoom}</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ width: 160 }}
          />
        </div>
        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <button type="button" onClick={async () => { await showCroppedImage(); setShowCropperModal(false); }} style={{ padding: '6px 18px', borderRadius: 4, border: '1px solid #3498db', background: '#3498db', color: '#fff', fontWeight: 600, fontSize: 15, cursor: isUploading ? 'not-allowed' : 'pointer' }} disabled={isUploading}>{isUploading ? t.uploading : t.crop}</button>
          <button type="button" onClick={() => { setShowCropperModal(false); if (!croppedImage) setImageSrc(null); }} style={{ marginLeft: 12, padding: '6px 18px', borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5', color: '#333', fontWeight: 500, fontSize: 15, cursor: 'pointer' }}>{t.cancel}</button>
        </div>
        <button type="button" onClick={() => { setShowCropperModal(false); if (!croppedImage) setImageSrc(null); }} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer' }} aria-label={t.close}>{t.close}</button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={componentRef}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, letterSpacing: 0.2 }}>{t.customize}</div>
      <div className="ai-generator-compact-box">
        {/* Only show style selection if there are multiple styles */}
        {styles.length > 1 && (
          <>
            <legend className="form__label ai-generator-style-label">{t.selectStyle}</legend>
            <div className="ai-generator-styles">
              {styles.map((style) => (
                <div
                  key={style.id}
                  className={`ai-generator-style${selectedStyle?.id === style.id ? ' selected' : ''}`}
                  onClick={() => setSelectedStyle(style)}
                >
                  {style.exampleImageUrl && (
                    <img
                      src={style.exampleImageUrl}
                      alt={style.name}
                      className="ai-generator-style-image"
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {/* Image Upload + Crop Tool */}
        <div style={{ margin: styles.length > 1 ? '24px 0' : '0' }}>
          <legend className="form__label ai-generator-style-label">{t.uploadImage}</legend>
          {!imageSrc && (
            <div
              className={`ai-generator-drop-area ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  onFileChange(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.files && target.files.length > 0) {
                    onFileChange(target.files[0]);
                  }
                };
                input.click();
              }}
            >
              {t.dragDropText}
            </div>
          )}
          {croppedImage && (
            <div style={{ textAlign: 'center' }}>
              <img src={croppedImage} alt="Cropped preview" style={{ width: 180, height: 180, objectFit: 'contain', borderRadius: 8, border: '1px solid #eee' }} />
              <div style={{ marginTop: 8 }}>
                <button type="button" onClick={() => setShowCropperModal(true)} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5', cursor: 'pointer' }}>{t.cropAgain}</button>
                <button type="button" onClick={() => { setImageSrc(null); setCroppedImage(null); }} style={{ marginLeft: 8, padding: '4px 12px', borderRadius: 4, border: '1px solid #e57373', background: '#ffeaea', color: '#c00', cursor: 'pointer' }}>{t.remove}</button>
              </div>
            </div>
          )}
        </div>
        {/* Cropper Modal (Portal) */}
        {cropperModal}
        {/* End Cropper Modal */}
        {/* End Image Upload + Crop Tool */}
        <div className="ai-generator-actions">
          <button
            className="product-form__submit button button--full-width button--secondary"
            onClick={handleGenerationToggle}
            disabled={!selectedStyle || !currentVariantId || generationLoading}
            style={{ cursor: (selectedStyle && currentVariantId) ? 'pointer' : 'not-allowed' }}
          >
            {generationLoading ? (
              <>
                <span className="ai-generator-spinner-small"></span>
                {loadingMessages[currentLoadingMessageIndex]}
              </>
            ) : generationState.generationSelected ? (
              t.changeGeneration
            ) : (
              t.generateAiArt
            )}
          </button>
          {generationResult && generationResult.length > 0 && (
            <div ref={generationsContainerRef} style={{ marginTop: 16, textAlign: 'center' }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{t.selectPreferred}</div>
              {generationResult.map((generationSet, setIndex) => (
                <div key={setIndex} style={{ marginBottom: 20 }}> {/* Add margin between sets */}
                  {generationSet.generations && generationSet.generations.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {generationSet.generations.map((gen: { generationId: string; imageUrl: string }, index: number) => (
                        <div
                          key={gen.generationId}
                          style={{
                            border: `2px solid ${selectedGeneratedImageUrl === gen.imageUrl ? '#3498db' : '#eee'}`,
                            borderRadius: 8,
                            padding: 5,
                            cursor: 'pointer',
                            transition: 'border-color 0.2s',
                          }}
                          onClick={() => handleImageSelection(gen.imageUrl, gen.generationId)}
                        >
                          <img
                            src={gen.imageUrl}
                            alt={`AI Art ${setIndex + 1}-${index + 1}`}
                            style={{
                              maxWidth: 180,
                              borderRadius: 4,
                              filter: gen.imageUrl.includes('mocked=true') ? 'grayscale(100%)' : 'none',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

            </div>
          )}
          <div
            style={{
              padding: '6px 12px',
              background: generationState.generationSelected
                ? 'rgba(34, 197, 94, 0.9)'
                : 'rgba(255, 255, 255, 0.2)',
              borderRadius: '15px',
              display: 'inline-block',
              fontSize: '12px',
              fontWeight: 600,
              backdropFilter: 'blur(10px)',
              marginTop: 8,
            }}
          >
            {generationState.generationSelected
              ? t.generationSelected
              : !currentVariantId
                ? t.selectVariantFirst
                : styles.length === 1
                  ? t.uploadImageToContinue
                  : t.selectStyleToContinue
            }
          </div>
        </div>
      </div>
    </div>
  );
};

// CSS styles (can be moved to a separate file)
const styles = `
.ai-generator-container {
  max-width: 600px;
  margin: 20px 0;
  /* padding: 20px; */
  /* border: 1px solid #e0e0e0; */
  border-radius: 8px;
  background: #fff;
}

.ai-generator-compact-box {
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(18, 18, 18, 0.04);
  padding: 18px 16px 16px 16px;
  margin-bottom: 0;
}

.ai-generator-loading {
  text-align: center;
  padding: 40px;
}

.ai-generator-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

.ai-generator-spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  display: inline-block;
  vertical-align: middle;
  margin-right: 8px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.ai-generator-error {
  text-align: center;
  padding: 20px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c33;
}

.ai-generator-disabled {
  text-align: center;
  padding: 20px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  color: #666;
}

.ai-generator-styles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 0;
  padding-top: 10px;
}

.ai-generator-style {
  /* border: 2px solid #e0e0e0; */
  /* border-radius: 8px; */
  /* padding: 15px; */
  cursor: pointer;
  transition: all 0.2s;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-generator-style.selected {
  outline: 2px solid #3498db;
  outline-offset: 2px;
  background: none;
}

.ai-generator-style-image {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}

.ai-generator-sizes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.ai-generator-size {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
  text-align: center;
}

.ai-generator-size:hover {
  border-color: #3498db;
}

.ai-generator-size.selected {
  border-color: #3498db;
  background: #f0f8ff;
}

.ai-generator-size-dimensions {
  font-size: 12px;
  color: #666;
}

.ai-generator-actions {
  margin-top: 30px;
  text-align: center;
}

.ai-generator-debug {
  margin-top: 30px;
  padding: 15px;
  background: #f8f8f8;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}

.form__label.ai-generator-style-label {
  box-sizing: border-box;
  color: rgba(18, 18, 18, 0.75);
  display: block;
  font-family: Assistant, sans-serif;
  font-size: 13px;
  font-style: normal;
  font-weight: 400;
  height: 19.5px;
  letter-spacing: 0.4px;
  line-height: 19.5px;
  margin-bottom: 2px;
  padding-inline-end: 2px;
  padding-inline-start: 0px;
  padding-left: 0px;
  unicode-bidi: isolate;
}

.ai-generator-drop-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  color: #666;
  transition: all 0.2s ease-in-out;
}

.ai-generator-drop-area.dragging {
  background-color: #f0f8ff;
  border-color: #3498db;
}
`;

// Inject styles into the page
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);

  // Log that dynamic aspect ratio feature is enabled
  console.log('✅ ProductAIGenerator: Dynamic aspect ratio based on variant dimensions is enabled');
  console.log('   When cropping, the aspect ratio will match the selected product variant');

  // Log that performance optimizations are enabled
  console.log('🚀 ProductAIGenerator: Performance optimizations enabled');
  console.log('   - Using refs instead of state for variant tracking to prevent re-renders');
  console.log('   - Optimized aspect ratio calculation to minimize state updates');
  console.log('   - Batched state updates for variant changes');
  console.log('   - Added performance monitoring to track renders');
}

export default ProductAIGenerator;
