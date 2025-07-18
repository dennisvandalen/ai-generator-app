import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [autoprefixer],
    },
  },
  build: {
    lib: {
      entry: './src/extension/index.tsx',
      name: 'AIGeneratorSDK',
      fileName: 'ai-generator',
      formats: ['iife'] // IIFE for maximum browser compatibility
    },
    outDir: 'extensions/theme-extension/assets',
    sourcemap: false, // Disabled - Shopify doesn't allow .map files in theme assets
    copyPublicDir: false, // Don't copy public files to theme extension assets
    rollupOptions: {
      external: [], // Bundle everything for theme extension compatibility
      output: {
        globals: {},
        entryFileNames: 'ai-generator.js', // Ensure .js extension for browser compatibility
        extend: true // Allow global variable to be reassigned
      }
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@extension': resolve(__dirname, 'src/extension'),
      '@': resolve(__dirname, 'src')
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
}); 