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

    // Work with the current selectedStyles array order (user's intended order)
    const draggedIndex = selectedStyles.findIndex(uuid => uuid === draggedItem);
    const targetIndex = selectedStyles.findIndex(uuid => uuid === targetStyleUuid);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newStyles = [...selectedStyles];
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

            <BlockStack gap="400">
              {(() => {
                // Get selected styles in the order they appear in selectedStyles array
                const selectedStylesFromList = selectedStyles
                  .map(uuid => aiStyles.find(style => style.uuid === uuid))
                  .filter(Boolean) as typeof aiStyles;
                const unselectedStyles = aiStyles.filter(style => !selectedStyles.includes(style.uuid));

                const renderStyleItem = (style: typeof aiStyles[0], isSelected: boolean, selectedIndex: number) => (
                  <div 
                    draggable={isSelected && !isLoading}
                    onDragStart={isSelected ? (e) => handleDragStart(e, style.uuid) : undefined}
                    onDragOver={isSelected ? (e) => handleDragOver(e, style.uuid) : undefined}
                    onDragLeave={isSelected ? handleDragLeave : undefined}
                    onDrop={isSelected ? (e) => handleDrop(e, style.uuid) : undefined}
                    style={{ 
                      padding: "8px", 
                      border: isSelected ? "2px solid #008060" : "1px solid #e1e3e5", 
                      borderRadius: "6px",
                      cursor: isLoading ? "not-allowed" : "pointer",
                      backgroundColor: isSelected ? "#f6f8fa" : "transparent",
                      opacity: isLoading ? 0.6 : 1,
                      transition: 'all 0.2s ease-in-out',
                      transform: draggedItem === style.uuid ? 'scale(1.02)' : 'scale(1)',
                      border: draggedOverItem === style.uuid ? '2px dashed #0066cc' : (isSelected ? "2px solid #008060" : "1px solid #e1e3e5")
                    }}
                    onClick={isLoading ? undefined : () => onToggleStyle(style.uuid, !isSelected)}
                  >
                    <InlineStack gap="200" align="start" blockAlign="center">
                      <div 
                        style={{
                          cursor: isSelected ? 'grab' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '2px',
                          width: '16px',
                          justifyContent: 'center'
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <circle cx="3" cy="3" r="1" fill="#666"/>
                            <circle cx="9" cy="3" r="1" fill="#666"/>
                            <circle cx="3" cy="6" r="1" fill="#666"/>
                            <circle cx="9" cy="6" r="1" fill="#666"/>
                            <circle cx="3" cy="9" r="1" fill="#666"/>
                            <circle cx="9" cy="9" r="1" fill="#666"/>
                          </svg>
                        )}
                      </div>
                      <Checkbox
                        label=""
                        id={`style-${style.id}`}
                        checked={isSelected}
                        onChange={() => onToggleStyle(style.uuid, !isSelected)}
                        disabled={isLoading}
                      />
                      {style.exampleImageUrl && (
                        <div style={{flexShrink: 0}}>
                          <Thumbnail
                            source={style.exampleImageUrl}
                            alt={style.name}
                            size="small"
                          />
                        </div>
                      )}
                      <InlineStack gap="150" align="start" blockAlign="center">
                        <Text variant="bodySm" as="p" fontWeight="medium">
                          {style.name}
                        </Text>
                        <Badge
                          tone={style.isActive ? "success" : "critical"}
                          size="small"
                        >
                          {style.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </InlineStack>
                      {isSelected && (
                        <div style={{
                          backgroundColor: '#0066cc',
                          color: 'white',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          flexShrink: 0,
                          marginLeft: 'auto'
                        }}>
                          {selectedIndex + 1}
                        </div>
                      )}
                    </InlineStack>
                  </div>
                );

                return (
                  <>
                    {selectedStylesFromList.length > 0 && (
                      <BlockStack gap="200">
                        <Text variant="headingSm" as="h4">
                          Selected Styles ({selectedStylesFromList.length})
                        </Text>
                        <BlockStack gap="200">
                          {selectedStylesFromList.map((style, index) => 
                            <div key={`selected-${style.uuid}`}>
                              {renderStyleItem(style, true, index)}
                            </div>
                          )}
                        </BlockStack>
                      </BlockStack>
                    )}

                    {unselectedStyles.length > 0 && (
                      <BlockStack gap="200">
                        <Text variant="headingSm" as="h4">
                          Available Styles ({unselectedStyles.length})
                        </Text>
                        <BlockStack gap="200">
                          {unselectedStyles.map((style) => 
                            <div key={`unselected-${style.uuid}`}>
                              {renderStyleItem(style, false, -1)}
                            </div>
                          )}
                        </BlockStack>
                      </BlockStack>
                    )}
                  </>
                );
              })()}

            </BlockStack>

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
