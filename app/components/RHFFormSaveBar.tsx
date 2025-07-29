import { SaveBar, useAppBridge } from '@shopify/app-bridge-react';
import { useEffect, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

interface RHFFormSaveBarProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  onSave?: (data: T) => void;
  onDiscard?: () => void;
}

export function RHFFormSaveBar<T extends FieldValues>({
  form,
  onSave,
  onDiscard,
}: RHFFormSaveBarProps<T>) {
  const [isClient, setIsClient] = useState(false);
  const appBridge = useAppBridge();
  const shopify = isClient ? appBridge : null;

  const {
    handleSubmit,
    formState: { isDirty, isSubmitting, errors },
    reset,
  } = form;

  const hasErrors = Object.keys(errors).length > 0;

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (shopify) {
      if (isDirty) {
        shopify.saveBar.show('rhf-form-save-bar');
      } else {
        shopify.saveBar.hide('rhf-form-save-bar');
      }
    }
  }, [isDirty, shopify]);

  const handleSave = handleSubmit((data) => {
    onSave?.(data);
  });

  const handleDiscard = () => {
    if (onDiscard) {
      onDiscard();
    } else {
      reset(); // Default behavior: reset form to initial values
    }
  };

  return (
    <SaveBar id="rhf-form-save-bar">
      <button
        variant="primary"
        onClick={handleSave}
        disabled={isSubmitting}
        loading={isSubmitting}
      >
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
      <button onClick={handleDiscard} disabled={isSubmitting}>
        Discard
      </button>
    </SaveBar>
  );
}
