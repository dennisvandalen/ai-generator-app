import React, { useState, useEffect } from 'react';

interface DebugPanelProps {
  aiConverterData: any;
  pageType: string;
  isThemeEditor: boolean;
  variantId?: string | null;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  aiConverterData,
  pageType,
  isThemeEditor,
  variantId
}) => {
  const [generationState, setGenerationState] = useState(() => 
    (window as any).__aiGenerationState || { generationSelected: false, generationId: null, isInitialized: false }
  );

  const [currentVariantId, setCurrentVariantId] = useState(() => 
    (window as any).__aiCurrentVariantId || variantId
  );

  // Listen for generation state changes via custom event
  useEffect(() => {
    const handleStateChange = (event: CustomEvent) => {
      setGenerationState({ ...event.detail });
    };

    window.addEventListener('aiGenerationStateChanged', handleStateChange as EventListener);

    return () => {
      window.removeEventListener('aiGenerationStateChanged', handleStateChange as EventListener);
    };
  }, []);

  // Listen for variant ID changes via custom event
  useEffect(() => {
    const handleVariantIdChange = (event: CustomEvent) => {
      setCurrentVariantId(event.detail.variantId);
    };

    window.addEventListener('aiVariantIdChanged', handleVariantIdChange as EventListener);

    return () => {
      window.removeEventListener('aiVariantIdChanged', handleVariantIdChange as EventListener);
    };
  }, []);

  const aiStatus = aiConverterData.aiEnabled === true ? '✅ ENABLED' : 
                  aiConverterData.aiEnabled === false ? '❌ DISABLED' : 
                  '⚠️ NOT SET';

  const hasLineItem = generationState.generationSelected && generationState.generationId;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 9999,
        maxWidth: '320px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
      }}
    >
      <div style={{ color: '#00ff88', fontWeight: 'bold', marginBottom: '8px' }}>
        🤖 AI Generator Debug
      </div>
      <div><strong>Theme Editor:</strong> {isThemeEditor ? '🎨 YES' : '🌐 LIVE'}</div>
      <div><strong>Page:</strong> {pageType}</div>
      <div><strong>Product:</strong> {aiConverterData.productId || 'N/A'}</div>
      <div><strong>Variant ID:</strong> {currentVariantId || 'N/A'}</div>
      <div><strong>AI Status:</strong> {aiStatus}</div>
      <div>
        <strong>Generation:</strong>{' '}
        <span style={{ color: generationState.generationSelected ? '#00ff88' : '#ff6b6b' }}>
          {generationState.generationSelected.toString()}
        </span>
      </div>
      <div><strong>Gen ID:</strong> {generationState.generationId || 'none'}</div>
      <div>
        <strong>Line Item:</strong>{' '}
        <span style={{ color: hasLineItem ? '#00ff88' : '#ff6b6b' }}>
          {hasLineItem ? 'will show in cart' : 'not set'}
        </span>
      </div>
      <div><strong>All Pages:</strong> {aiConverterData.enableForAllPages || 'false'}</div>
      <div><strong>Cart:</strong> {aiConverterData.enableOnCart || 'false'}</div>
      <div><strong>Collection:</strong> {aiConverterData.enableOnCollection || 'false'}</div>
      {aiConverterData.lastUpdated && (
        <div>
          <strong>Updated:</strong> {new Date(aiConverterData.lastUpdated).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}; 