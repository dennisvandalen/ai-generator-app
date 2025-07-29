export interface Translations {
  loading: string;
  loadingAiOptions: string;
  error: string;
  retry: string;
  notAvailable: string;
  customize: string;
  selectStyle: string;
  uploadImage: string;
  dragDropText: string;
  cropImage: string;
  zoom: string;
  crop: string;
  uploading: string;
  cancel: string;
  close: string;
  cropAgain: string;
  remove: string;
  changeGeneration: string;
  generateAiArt: string;
  selectPreferred: string;
  generationSelected: string;
  selectVariantFirst: string;
  uploadImageToContinue: string;
  selectStyleToContinue: string;
  uploadAndSelectImageFirst: string;
  loadingMessages: string[];
}

const translations: Record<string, Translations> = {
  en: {
    loading: 'Loading...',
    loadingAiOptions: 'Loading AI generation options...',
    error: 'Error',
    retry: 'Retry',
    notAvailable: 'AI generation is not available for this product',
    customize: 'Personalize',
    selectStyle: 'Select style:',
    uploadImage: 'Upload your image:',
    dragDropText: 'Drag & Drop your image here or click to upload',
    cropImage: 'Crop your image',
    zoom: 'Zoom',
    crop: 'Crop',
    uploading: 'Uploading...',
    cancel: 'Cancel',
    close: '×',
    cropAgain: 'Crop Again',
    remove: 'Remove',
    changeGeneration: '🔄 Change Generation',
    generateAiArt: '🎨 Generate Artwork',
    selectPreferred: 'Select your preferred Artwork:',
    generationSelected: '✅ Generation Selected',
    selectVariantFirst: '⚠️ Select a variant first',
    uploadImageToContinue: '🚀 Upload image to continue',
    selectStyleToContinue: '🚀 Select AI Style to continue',
    uploadAndSelectImageFirst: '🎨 Upload and select an image first',
    loadingMessages: [
      'Summoning pixels...',
      'Unleashing creativity...',
      'Crafting your masterpiece...',
      'Adding a touch of magic...',
      'Almost there...',
      'Generating artwork...',
    ],
  },
  nl: {
    loading: 'Laden...',
    loadingAiOptions: 'AI-generatie opties laden...',
    error: 'Fout',
    retry: 'Opnieuw proberen',
    notAvailable: 'AI-generatie is niet beschikbaar voor dit product',
    customize: 'Personaliseren',
    selectStyle: 'Selecteer stijl:',
    uploadImage: 'Upload je afbeelding:',
    dragDropText: 'Sleep & zet je afbeelding hier neer of klik om te uploaden',
    cropImage: 'Afbeelding bijsnijden',
    zoom: 'Zoom',
    crop: 'Bijsnijden',
    uploading: 'Uploaden...',
    cancel: 'Annuleren',
    close: '×',
    cropAgain: 'Opnieuw bijsnijden',
    remove: 'Verwijderen',
    changeGeneration: '🔄 Generatie wijzigen',
    generateAiArt: '🎨 Kunstwerk genereren',
    selectPreferred: 'Selecteer je favoriete kunstwerk:',
    generationSelected: '✅ Generatie geselecteerd',
    selectVariantFirst: '⚠️ Selecteer eerst een variant',
    uploadImageToContinue: '🚀 Upload afbeelding om door te gaan',
    selectStyleToContinue: '🚀 Selecteer stijl om door te gaan',
    uploadAndSelectImageFirst: '🎨 Upload en selecteer eerst een afbeelding',
    loadingMessages: [
      'Pixels oproepen...',
      'Creativiteit ontketenen...',
      'Je meesterwerk maken...',
      'Een vleugje magie toevoegen...',
      'Bijna klaar...',
      'Kunstwerk genereren...',
    ],
  },
};

export function getLocale(): string {
  try {
    // Try to get locale from Shopify
    if (typeof window !== 'undefined' && (window as any).Shopify?.locale) {
      const shopifyLocale = (window as any).Shopify.locale;
      console.log('🌍 Detected Shopify locale:', shopifyLocale);

      // Convert Shopify locale format (e.g., 'nl-NL', 'en-US') to our simple format
      const simplifiedLocale = shopifyLocale.split('-')[0].toLowerCase();

      // Check if we have translations for this locale
      if (translations[simplifiedLocale]) {
        return simplifiedLocale;
      }
    }

    // Fallback to browser locale
    if (typeof navigator !== 'undefined') {
      const browserLocale = navigator.language.split('-')[0].toLowerCase();
      console.log('🌍 Detected browser locale:', browserLocale);

      if (translations[browserLocale]) {
        return browserLocale;
      }
    }
  } catch (error) {
    console.warn('Error detecting locale:', error);
  }

  // Default fallback
  console.log('🌍 Using fallback locale: en');
  return 'en';
}

export function getTranslations(): Translations {
  const locale = getLocale();
  return translations[locale] || translations.en;
}

// Helper function to add new translations
export function addTranslations(locale: string, newTranslations: Translations) {
  translations[locale] = newTranslations;
}

// Export available locales for reference
export const availableLocales = Object.keys(translations);
