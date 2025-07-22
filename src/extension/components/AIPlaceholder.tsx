import React from 'react';

interface AIPlaceholderProps {
  isThemeEditor: boolean;
  productId?: string | number;
  shop?: string;
}

export const AIPlaceholder: React.FC<AIPlaceholderProps> = ({
  isThemeEditor,
}) => {

  const baseStyle = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '16px',
    borderRadius: '12px',
    marginBottom: '16px',
    textAlign: 'center' as const,
    boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  };

  const backgroundPattern = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `
      radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1) 1px, transparent 1px),
      radial-gradient(circle at 80% 40%, rgba(255,255,255,0.1) 1px, transparent 1px),
      radial-gradient(circle at 40% 80%, rgba(255,255,255,0.1) 1px, transparent 1px)
    `,
    backgroundSize: '50px 50px, 60px 60px, 40px 40px',
  };

  const contentStyle = {
    position: 'relative' as const,
    zIndex: 1,
  };

  // Only render in theme editor
  if (!isThemeEditor) return null;

  return (
    <div style={baseStyle}>
      <div style={backgroundPattern}></div>
      <div style={contentStyle}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎨✨</div>
        <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
          AI Art Generation Available!
        </div>
        <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '12px' }}>
          Transform your images with AI magic
        </div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          color: 'rgba(255, 255, 255, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '500',
          display: 'inline-block',
          marginBottom: '8px',
          backdropFilter: 'blur(10px)',
        }}>
          🎨 Theme Editor Preview
        </div>
        <div style={{
          padding: '6px 12px',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '15px',
          display: 'inline-block',
          fontSize: '12px',
          fontWeight: '600',
          backdropFilter: 'blur(10px)',
        }}>
          🚀 Interactive on Live Store
        </div>

        {/* Simple placeholder message */}
        <div style={{
          marginTop: '12px',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          display: 'inline-block'
        }}>
          AI Generator is ready to use
        </div>
      </div>
    </div>
  );
};
