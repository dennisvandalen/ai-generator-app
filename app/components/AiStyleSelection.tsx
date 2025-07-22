import {Badge, BlockStack, Button, Card, Checkbox, InlineStack, Text, Thumbnail} from "@shopify/polaris";
import type {AiStyle} from "~/db/schema";
import {useCallback, useState} from "react";

type Props = {
  aiStyles: AiStyle[];
  onToggleStyle: (id: string, checked: boolean) => void;
  selectedStyles: string[];
  onSelectedStylesChange: (styles: string[]) => void;
  isLoading: boolean;
}

export const AiStyleSelection = ({aiStyles, selectedStyles, onSelectedStylesChange, isLoading, onToggleStyle}: Props) => {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedOverItem, setDraggedOverItem] = useState<string | null>(null);
  const handleDragStart = useCallback((e: React.DragEvent, styleUuid: string) => {
    setDraggedItem(styleUuid);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, styleUuid: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverItem(styleUuid);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDraggedOverItem(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetStyleUuid: string) => {
    e.preventDefault();

    if (!draggedItem || draggedItem === targetStyleUuid) {
      setDraggedItem(null);
      setDraggedOverItem(null);
      return;
    }

    const currentStyles = selectedStyles;
    const draggedIndex = currentStyles.findIndex(uuid => uuid === draggedItem);
    const targetIndex = currentStyles.findIndex(uuid => uuid === targetStyleUuid);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newStyles = [...currentStyles];
      const [draggedStyle] = newStyles.splice(draggedIndex, 1);
      newStyles.splice(targetIndex, 0, draggedStyle);
      onSelectedStylesChange(newStyles);
    }

    setDraggedItem(null);
    setDraggedOverItem(null);
  }, [draggedItem, selectedStyles, onSelectedStylesChange]);
  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          AI Styles Selection
        </Text>

        {aiStyles.length > 0 ? (
          <BlockStack gap="400">
            <Text variant="bodyMd" as="p" tone="subdued">
              Select which AI styles are available for this product. Customers will be able to choose from the selected
              styles when generating images.
            </Text>

            {selectedStyles.length > 0 && (
              <Text variant="bodySm" as="p" tone="subdued">
                💡 <strong>Selected styles appear first and are numbered in order.</strong> Drag and drop to reorder them
                - this controls the order customers see when generating images.
              </Text>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '16px',
              gridAutoFlow: 'dense' // Helps with the ordering of items
            }}>
              {/* Render all styles in a single loop with consistent keys */}
              {aiStyles.map((style) => {
                const isSelected = selectedStyles.includes(style.uuid);
                const selectedIndex = selectedStyles.indexOf(style.uuid);
                const isDragging = draggedItem === style.uuid;
                const isDraggedOver = draggedOverItem === style.uuid;

                return (
                  <div
                    key={`style-${style.id}`}
                    draggable={isSelected && !isLoading}
                    onDragStart={isSelected ? (e) => handleDragStart(e, style.uuid) : undefined}
                    onDragOver={isSelected ? (e) => handleDragOver(e, style.uuid) : undefined}
                    onDragLeave={isSelected ? handleDragLeave : undefined}
                    onDrop={isSelected ? (e) => handleDrop(e, style.uuid) : undefined}
                    onClick={isLoading ? undefined : () => onToggleStyle(style.uuid, !isSelected)}
                    style={{
                      cursor: isLoading ? 'not-allowed' : (isSelected ? 'grab' : 'pointer'),
                      transition: 'all 0.2s ease-in-out',
                      transform: isDragging ? 'scale(1.05)' : (isSelected ? 'scale(1.02)' : 'scale(1)'),
                      opacity: isLoading ? 0.6 : (isDragging ? 0.8 : 1),
                      border: isDraggedOver ? '2px dashed #0066cc' : 'none',
                      position: 'relative',
                      order: isSelected ? selectedIndex : aiStyles.length + 1, // Keep selected styles first in order
                      willChange: 'transform, opacity', // Hint to browser to optimize these animations
                    }}
                  >
                    <div style={{position: 'relative'}}>
                      <Card
                        background={isSelected ? "bg-surface-selected" : "bg-surface-secondary"}
                        padding="300"
                      >
                        <InlineStack gap="300" align="start" blockAlign="center">
                          {isSelected && (
                            <div style={{
                              backgroundColor: '#0066cc',
                              color: 'white',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              flexShrink: 0
                            }}>
                              {selectedIndex + 1}
                            </div>
                          )}
                          {style.exampleImageUrl && (
                            <div style={{flexShrink: 0}}>
                              <Thumbnail
                                source={style.exampleImageUrl}
                                alt={style.name}
                                size="small"
                              />
                            </div>
                          )}
                          <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="semibold" as="span">
                              {style.name}
                            </Text>
                            <div style={{alignSelf: 'flex-start'}}>
                              <Badge
                                tone={style.isActive ? "success" : "critical"}
                                size="small"
                              >
                                {style.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </BlockStack>
                        </InlineStack>
                      </Card>
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        zIndex: 1
                      }}>
                        <Checkbox
                          label={isSelected ? `Disable ${style.name} for this product` : `Enable ${style.name} for this product`}
                          labelHidden
                          checked={isSelected}
                          onChange={() => onToggleStyle(style.uuid, !isSelected)}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>

            <InlineStack gap="200" align="space-between">
              <Text variant="bodySm" tone="subdued" as="span">
                {selectedStyles.length} of {aiStyles.length} styles selected
              </Text>
              {selectedStyles.length > 0 && (
                <Button
                  variant="plain"
                  size="slim"
                  onClick={() => onSelectedStylesChange([])}
                  disabled={isLoading}
                >
                  Clear all
                </Button>
              )}
            </InlineStack>
          </BlockStack>
        ) : (
          <BlockStack gap="300">
            <Text variant="bodyMd" tone="subdued" as="p">
              No AI styles have been created yet.
            </Text>
            <Button variant="primary" url="/app/styles" disabled={isLoading}>
              Create AI Styles
            </Button>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  )
}
