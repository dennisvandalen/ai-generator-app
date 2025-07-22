import { Modal, Text } from "@shopify/polaris";

type Props = {
  imageUrl: string | null;
  altText: string | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

export function ImageModal({
  imageUrl,
  altText,
  isOpen,
  onClose,
  onDownload
}: Props) {
  const handleDownload = async () => {
    if (!imageUrl || !altText) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename from alt text and timestamp
      const filename = `${altText.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.jpg`;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      if (onDownload) {
        onDownload();
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (!imageUrl || !altText) {
    return null;
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Image Preview"
      primaryAction={{
        content: 'Download',
        onAction: handleDownload,
      }}
      secondaryActions={[
        {
          content: 'Close',
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <div style={{ textAlign: 'center' }}>
          <img
            src={imageUrl}
            alt={altText}
            style={{
              maxWidth: '100%',
              maxHeight: '70vh',
              objectFit: 'contain',
              borderRadius: '8px',
            }}
          />
          <div style={{ marginTop: '16px' }}>
            <Text as="p" tone="subdued">
              {altText}
            </Text>
          </div>
        </div>
      </Modal.Section>
    </Modal>
  );
}
