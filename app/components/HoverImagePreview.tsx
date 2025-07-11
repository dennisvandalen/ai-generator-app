import { useState, useRef } from "react";
import { Thumbnail, Box, Text } from "@shopify/polaris";

interface HoverImagePreviewProps {
  imageUrl: string | null;
  altText: string;
  fallbackText?: string;
  onImageClick?: (imageUrl: string, altText: string) => void;
}

export function HoverImagePreview({ 
  imageUrl, 
  altText, 
  fallbackText = "No image", 
  onImageClick 
}: HoverImagePreviewProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (imageUrl) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (imageUrl) {
      setMousePosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleClick = () => {
    if (imageUrl && onImageClick) {
      onImageClick(imageUrl, altText);
    }
  };

  // Calculate smart positioning to keep preview in viewport
  const getPreviewPosition = () => {
    const previewWidth = 300;
    const previewHeight = 300;
    const offset = 15;
    const verticalOffset = 100;

    let left = mousePosition.x + offset;
    let top = mousePosition.y - verticalOffset;

    // Check if preview would go off the right edge
    if (left + previewWidth > window.innerWidth) {
      left = mousePosition.x - previewWidth - offset;
    }

    // Check if preview would go off the bottom edge
    if (top + previewHeight > window.innerHeight) {
      top = mousePosition.y - previewHeight - offset;
    }

    // Check if preview would go off the top edge
    if (top < 0) {
      top = mousePosition.y + offset;
    }

    // Check if preview would go off the left edge
    if (left < 0) {
      left = offset;
    }

    return { left, top };
  };

  if (!imageUrl) {
    return (
      <Box padding="200">
        <Text as="span" tone="subdued">{fallbackText}</Text>
      </Box>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      >
        <Thumbnail
          source={imageUrl}
          alt={altText}
          size="small"
        />
      </div>
      
      {isHovered && (
        <div
          style={{
            position: 'fixed',
            left: getPreviewPosition().left,
            top: getPreviewPosition().top,
            zIndex: 9999,
            pointerEvents: 'none',
            backgroundColor: 'white',
            border: '1px solid #e1e1e1',
            borderRadius: '8px',
            padding: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            width: '300px',
            height: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={imageUrl}
            alt={altText}
            style={{
              maxWidth: '284px',
              maxHeight: '284px',
              objectFit: 'contain',
              borderRadius: '4px',
            }}
          />
        </div>
      )}
    </>
  );
} 