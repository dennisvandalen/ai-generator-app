# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Shopify AI Image Generator app built with Remix, Drizzle ORM, and TypeScript. The app allows merchants to enable AI-powered custom image generation for their products, with customers uploading images that get transformed using AI styles configured by the merchant.

## Key Commands

### Development
- `npm run dev` - Start development server with Shopify CLI
- `npm run dev:extension` - Build theme extension in watch mode
- `npm run dev:full` - Run both app and extension development servers

### Database
- `npm run setup` - Generate database schema and run migrations
- `npm run drizzle` - Access Drizzle Kit CLI for database operations

### Building & Testing
- `npm run build` - Build the Remix application
- `npm run build:extension` - Build theme extension for production
- `npm run lint` - Run ESLint on the codebase
- `npm run test` - Run Vitest tests
- `npm run test:watch` - Run tests in watch mode

### Multi-Environment Deployment
- `npm run config:use:dev` - Switch to development config
- `npm run config:use:staging` - Switch to staging config  
- `npm run config:use:production` - Switch to production config
- `npm run deploy:staging` - Deploy Shopify app to staging
- `npm run deploy:production` - Deploy Shopify app to production
- `npm run fly:deploy:staging` - Deploy to Fly.io staging
- `npm run fly:deploy:production` - Deploy to Fly.io production

## Architecture

### Core Technology Stack
- **Framework**: Remix with TypeScript
- **Database**: Drizzle ORM with SQLite (dev) / Turso (production)
- **Shopify Integration**: @shopify/shopify-app-remix for OAuth, webhooks, and GraphQL
- **UI**: Shopify Polaris components
- **AI Generation**: FAL.ai client for image processing
- **File Storage**: AWS S3 for image storage
- **State Management**: Zustand with Immer for complex forms

### Database Architecture
The app uses a comprehensive schema for multi-tenant AI image generation:

**Core Business Tables**:
- `shops` - Shopify store installations with OAuth tokens
- `products` - Shopify products enabled for AI generation  
- `aiStyles` - AI prompt templates for image transformation
- `generations` - Individual image generation records with status tracking
- `orders` - Shopify orders that trigger final high-res generations

**Product Base System** (for template-based products):
- `productBases` - Foundational product templates (e.g., "Ceramic Mug", "T-Shirt") 
- `productBaseVariants` - Specific size/color combinations with AI generation dimensions
- `productBaseOptions` - Option types (Size, Color, Material)
- `productProductBases` - Many-to-many mapping between Shopify products and product bases
- `productBaseVariantMappings` - Maps product base variants to Shopify variants

**System Tables**:
- `watermarks` - Merchant watermark settings for preview images
- `quotas` - Usage limits and current consumption tracking

### Directory Structure

#### `/app` - Main Remix Application
- `/routes` - Remix routes (admin pages, API endpoints, webhooks)
- `/components` - Reusable Polaris UI components
- `/db/schema.ts` - Drizzle database schema definition
- `/stores` - Zustand state management stores
- `/services` - Business logic services (AI generation, etc.)
- `/utils` - Utility functions and helpers

#### `/src` - Theme Extension & Shared Code  
- `/extension` - Preact components for storefront integration
- `/shared` - Code shared between admin app and theme extension

#### `/extensions/theme-extension` - Shopify Theme App Extension
- Liquid templates and JavaScript for storefront customer interface

### Multi-Environment Setup
The app supports three environments with separate configurations:
- **Development**: Local SQLite database, development Shopify app
- **Staging**: Turso database, staging Shopify app, Fly.io staging deployment
- **Production**: Turso database, production Shopify app, Fly.io production deployment

Environment variables are managed through:
- `.env` for development
- `fly.staging.toml` for staging environment variables
- `fly.toml` for production environment variables

### Key Implementation Details

#### Session Storage
Uses official `@shopify/shopify-app-session-storage-drizzle` package with custom session table schema. The implementation properly instantiates Shopify Session objects rather than plain objects to avoid `session.isActive` errors.

#### Form State Management  
Complex forms use Zustand with Immer for immutable state updates. Form stores are created using a factory pattern in `/app/stores/createFormStore.ts`.

#### AI Generation Flow
1. **Preview Generation**: Customer uploads image → low-res watermarked preview
2. **Order Processing**: Shopify webhook triggers → high-res final generation
3. **Status Tracking**: Comprehensive status tracking through `generations` table

#### App Proxy Configuration
- Prefix: `tools`
- Subpath: `autopictura` 
- Routes accessible via `https://shop.myshopify.com/tools/autopictura/*`

## Development Patterns

### Database Queries
Use Drizzle ORM with proper relations defined in schema. Always use transactions for multi-table operations.

### Route Organization
- `/app` routes - Admin interface pages
- `/api` routes - REST API endpoints and app proxy routes  
- `/webhooks` routes - Shopify webhook handlers
- `/modals` routes - Modal components for admin interface

### Component Architecture
Components use Shopify Polaris design system. Form components integrate with Zustand stores for state management.

### Error Handling
All routes should include proper error boundaries and validation using Zod schemas where appropriate.

## Important Notes

- Database migrations run automatically via `npm run setup`
- Always test both admin interface and storefront theme extension
- Environment switching requires running appropriate config commands
- AI generation involves both preview (immediate) and final (post-order) processing
- Image storage uses S3 with proper CORS configuration for direct uploads