declare global {
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
      SHOPIFY_API_KEY: string;
      R2_BUCKET: string;
      R2_ENDPOINT: string;
      R2_ACCESS_KEY_ID: string;
      R2_SECRET_ACCESS_KEY: string;
      FAL_KEY: string;
      MOCK_AI_GENERATION?: 'true' | 'false';
    }
  }
}

export {};
