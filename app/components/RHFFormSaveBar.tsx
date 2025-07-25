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
        // Enable leave confirmation when form is dirty
        shopify.saveBar?.leaveConfirmation(true);
      } else {
        shopify.saveBar.hide('rhf-form-save-bar');
        // Disable leave confirmation when form is clean
        shopify.saveBar?.leaveConfirmation(false);
      }
    }
  }, [isDirty, shopify]);

  // Clean up leave confirmation on unmount
  useEffect(() => {
    return () => {
      if (shopify) {
        shopify.saveBar?.leaveConfirmation(false);
      }
    };
  }, [shopify]);

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
      >
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
      <button onClick={handleDiscard} disabled={isSubmitting}>
        Discard
      </button>
    </SaveBar>
  );
}

// Alternative: Hook-based approach that doesn't render anything
// This gives you more flexibility to render your own save bar UI
export function useRHFSaveBar<T extends FieldValues>(
  form: UseFormReturn<T>,
  options?: {
    onSave?: (data: T) => void;
    onDiscard?: () => void;
    saveBarId?: string;
  }
) {
  const [isClient, setIsClient] = useState(false);
  const appBridge = useAppBridge();
  const shopify = isClient ? appBridge : null;

  const {
    handleSubmit,
    formState: { isDirty, isSubmitting, errors },
    reset,
  } = form;

  const hasErrors = Object.keys(errors).length > 0;
  const saveBarId = options?.saveBarId || 'rhf-save-bar';

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (shopify) {
      if (isDirty) {
        shopify.saveBar.show(saveBarId);
        // Enable leave confirmation when form is dirty
        shopify.saveBar?.leaveConfirmation(true);
      } else {
        shopify.saveBar.hide(saveBarId);
        // Disable leave confirmation when form is clean
        shopify.saveBar?.leaveConfirmation(false);
      }
    }
  }, [isDirty, shopify, saveBarId]);

  // Clean up leave confirmation on unmount
  useEffect(() => {
    return () => {
      if (shopify) {
        shopify.saveBar?.leaveConfirmation(false);
      }
    };
  }, [shopify]);

  const handleSave = handleSubmit((data) => {
    options?.onSave?.(data);
  });

  const handleDiscard = () => {
    if (options?.onDiscard) {
      options.onDiscard();
    } else {
      reset();
    }
  };

  return {
    isDirty,
    isSubmitting,
    hasErrors,
    handleSave,
    handleDiscard,
    canSave: isDirty && !isSubmitting,
  };
}