import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProductDataAPI, ProductData, ProductStyle } from '../../shared/api/productData';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import ReactDOM from 'react-dom';
import { AIGeneratorAPI } from '../../extension/api/client';

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
  const api = new AIGeneratorAPI();

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

  const loadingMessages = [
    "Summoning pixels...",
    "Unleashing creativity...",
    "Crafting your masterpiece...",
    "Adding a touch of magic...",
    "Almost there...",
    "Generating AI art...",
  ];
  const [currentLoadingMessageIndex, setCurrentLoadingMessageIndex] = useState(0);

  const generationsContainerRef = useRef<HTMLDivElement>(null);

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
      generationsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [generationResult]);

  useEffect(() => {
    loadProductData();
  }, [productId]);

  const loadProductData = async () => {
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
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load product data';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper to generate a UUID for generationId
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

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
        setError('Please select a style.');
        return;
      }
      if (!imageUrl) {
        setError('Please upload and crop an image first.');
        return;
      }
      setGenerationLoading(true);
      setError(null);
      try {
        const result = await api.createAIGeneration({
          styleId: style.id,
          imageUrl,
          productId: productId, // Pass productId
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
        setSelectedStyle(null); // Deselect the style after generation
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate AI art');
        onUpdateGenerationState(false, null); // Disable ATC on error
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
          const url = await api.uploadImage(base64, filename);
          setUploadedImageUrl(url);
          // Store on window for now
          if (typeof window !== 'undefined') {
            (window as any).__aiUploadedImageUrl = url;
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
          setIsUploading(false); // Set loading to false after upload attempt
        }
      } else {
        setIsUploading(false); // Set loading to false if no cropped image
      }
    } catch (e) {
      setError('Failed to crop image');
      setIsUploading(false); // Set loading to false on crop error
    }
  }, [imageSrc, croppedAreaPixels, api, productId]);

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

  // Utility: crop image to max 1024px on the longest side, preserving crop aspect ratio
  async function getCroppedImg(imageSrc: string, crop: any): Promise<string> {
    const image = await createImage(imageSrc);
    // Calculate aspect ratio from crop area
    const aspect = crop.width / crop.height;
    const maxSide = 1024;
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
  }

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
        <p>Loading AI generation options...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-generator-error">
        <p>Error: {error}</p>
        <button onClick={loadProductData}>Retry</button>
      </div>
    );
  }

  if (!productData?.enabled) {
    return (
      <div className="ai-generator-disabled">
        <p>{productData?.message || 'AI generation is not available for this product'}</p>
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
        <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 12 }}>Crop your image</div>
        <div style={{ position: 'relative', width: 340, height: 340, background: '#eee', margin: '0 auto' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={210/297}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            showGrid={true}
            disableAutomaticStylesInjection={true}
          />
        </div>
        <div style={{ margin: '18px 0 0 0', textAlign: 'center' }}>
          <label style={{ fontSize: 13, marginRight: 8 }}>Zoom</label>
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
          <button type="button" onClick={async () => { await showCroppedImage(); setShowCropperModal(false); }} style={{ padding: '6px 18px', borderRadius: 4, border: '1px solid #3498db', background: '#3498db', color: '#fff', fontWeight: 600, fontSize: 15, cursor: isUploading ? 'not-allowed' : 'pointer' }} disabled={isUploading}>{isUploading ? 'Uploading...' : 'Crop'}</button>
          <button type="button" onClick={() => { setShowCropperModal(false); if (!croppedImage) setImageSrc(null); }} style={{ marginLeft: 12, padding: '6px 18px', borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5', color: '#333', fontWeight: 500, fontSize: 15, cursor: 'pointer' }}>Cancel</button>
        </div>
        <button type="button" onClick={() => { setShowCropperModal(false); if (!croppedImage) setImageSrc(null); }} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer' }} aria-label="Close">×</button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={componentRef}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, letterSpacing: 0.2 }}>Customize</div>
      <div className="ai-generator-compact-box">
        <legend className="form__label ai-generator-style-label">Select style:</legend>
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
        {/* Image Upload + Crop Tool */}
        <div style={{ margin: '24px 0' }}>
          <legend className="form__label ai-generator-style-label">Upload your image:</legend>
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
              Drag & Drop your image here or click to upload
            </div>
          )}
          {croppedImage && (
            <div style={{ textAlign: 'center' }}>
              <img src={croppedImage} alt="Cropped preview" style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />
              <div style={{ marginTop: 8 }}>
                <button type="button" onClick={() => setShowCropperModal(true)} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5', cursor: 'pointer' }}>Crop Again</button>
                <button type="button" onClick={() => { setImageSrc(null); setCroppedImage(null); }} style={{ marginLeft: 8, padding: '4px 12px', borderRadius: 4, border: '1px solid #e57373', background: '#ffeaea', color: '#c00', cursor: 'pointer' }}>Remove</button>
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
            disabled={!selectedStyle || generationLoading}
            style={{ cursor: selectedStyle ? 'pointer' : 'not-allowed' }}
          >
            {generationLoading ? (
              <>
                <span className="ai-generator-spinner-small"></span>
                {loadingMessages[currentLoadingMessageIndex]}
              </>
            ) : generationState.generationSelected ? (
              '🔄 Change Generation'
            ) : (
              '🎨 Generate AI Art'
            )}
          </button>
          {generationResult && generationResult.length > 0 && (
            <div ref={generationsContainerRef} style={{ marginTop: 16, textAlign: 'center' }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Select your preferred AI Art:</div>
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
            {generationState.generationSelected ? '✅ Generation Selected' : '🚀 Select AI Style to continue'}
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
}

export default ProductAIGenerator; 