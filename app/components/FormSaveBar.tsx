import { SaveBar, useAppBridge } from '@shopify/app-bridge-react';
import { useEffect, useState } from 'react';

interface FormSaveBarProps {
  isDirty: boolean;
  isSubmitting: boolean;
  hasErrors: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function FormSaveBar({
  isDirty,
  isSubmitting,
  hasErrors,
  onSave,
  onDiscard,
}: FormSaveBarProps) {
  const [isClient, setIsClient] = useState(false);
  const appBridge = useAppBridge();
  const shopify = isClient ? appBridge : null;

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (shopify) {
      if (isDirty && !hasErrors) {
        shopify.saveBar.show('form-save-bar');
      } else {
        shopify.saveBar.hide('form-save-bar');
      }
    }
  }, [isDirty, hasErrors, shopify]);

  return (
    <SaveBar id="form-save-bar">
      <button
        variant="primary"
        onClick={onSave}
        disabled={isSubmitting || hasErrors}
      >
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
      <button onClick={onDiscard} disabled={isSubmitting}>
        Discard
      </button>
    </SaveBar>
  );
}
