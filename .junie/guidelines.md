# AI Generator App Development Guidelines

This document provides essential information for developers working on the AI Generator App project. It covers build/configuration instructions, testing procedures, and other development guidelines specific to this project.

## Build & Configuration Instructions

### Environment Setup

1. **Node.js Requirements**: 
   - Node.js v20.10 or higher is required (as specified in package.json)
   - Use nvm or a similar tool to manage Node.js versions if needed

2. **Initial Setup**:
   ```bash
   # Install dependencies
   npm install
   
   # Set up the database (generates schema and runs migrations)
   npm run setup
   ```

3. **Environment Variables**:
   - In development, the app uses a SQLite database by default
   - For production, set `DATABASE_URL` to your database connection string
   - Other environment variables may be required for Shopify API integration

### Development Workflow

1. **Development Server**:
   ```bash
   # Run the main app in development mode
   npm run dev
   
   # Run the extension in development mode
   npm run dev:extension
   
   # Run both the app and extension concurrently
   npm run dev:full
   ```

2. **Database Management**:
   - The project uses Drizzle ORM with SQLite
   - Schema is defined in `app/db/schema.ts`
   - To update the database schema:
     ```bash
     # Generate migrations
     npm run drizzle -- generate
     
     # Apply migrations
     npm run drizzle -- migrate
     
     # Or use the combined setup command
     npm run setup
     ```

3. **Building for Production**:
   ```bash
   # Build the main app
   npm run build
   
   # Build the extension
   npm run build:extension
   
   # Start the production server
   npm run start
   ```

4. **Shopify CLI Commands**:
   ```bash
   # Link to your Shopify Partner account
   npm run config:link
   
   # Deploy the app to Shopify
   npm run deploy
   ```

## Testing Information

### Testing Setup

The project uses Vitest as the testing framework, which integrates well with the Vite build system. The testing setup includes:

1. **Test Configuration**:
   - Configuration is in `vitest.config.ts`
   - Global test setup is in `vitest.setup.ts`
   - Tests use JSDOM for browser environment simulation

2. **Running Tests**:
   ```bash
   # Run tests once
   npm test
   
   # Run tests in watch mode (for development)
   npm run test:watch
   
   # Run tests with coverage reporting
   npm run test:coverage
   ```

### Writing Tests

1. **Test File Naming**:
   - Test files should be named with `.test.ts` or `.spec.ts` suffix
   - Place test files next to the files they test or in a `__tests__` directory

2. **Example Test**:
   Here's a simple example of a utility function test:

   ```typescript
   import { describe, it, expect } from 'vitest';
   
   // Function to test
   function formatDate(date: Date | string): string {
     const d = typeof date === 'string' ? new Date(date) : date;
     return d.toLocaleDateString('en-US', {
       year: 'numeric',
       month: 'long',
       day: 'numeric',
     });
   }
   
   describe('formatDate utility', () => {
     it('formats a Date object correctly', () => {
       const date = new Date(2025, 6, 22); // July 22, 2025
       expect(formatDate(date)).toBe('July 22, 2025');
     });
   });
   ```

3. **Testing React Components**:
   - Use `@testing-library/react` for component testing
   - Example of testing a component:

   ```typescript
   import { describe, it, expect } from 'vitest';
   import { render, screen } from '@testing-library/react';
   import MyComponent from './MyComponent';
   
   describe('MyComponent', () => {
     it('renders correctly', () => {
       render(MyComponent());
       expect(screen.getByText('Expected Text')).toBeInTheDocument();
     });
   });
   ```

4. **Mocking Shopify Dependencies**:
   - The test setup includes mocks for Shopify App Bridge and other Shopify-specific APIs
   - Extend these mocks in `vitest.setup.ts` as needed for your tests

## Additional Development Information

### Project Architecture

1. **Tech Stack**:
   - **Frontend**: React with Remix framework and Shopify Polaris components
   - **Backend**: Node.js with Remix
   - **Database**: SQLite with Drizzle ORM
   - **Build Tool**: Vite
   - **AI Integration**: FAL AI client for image generation

2. **Key Directories**:
   - `app/routes`: Contains all route components (Remix file-based routing)
   - `app/db`: Database schema and migrations
   - `app/components`: Reusable React components
   - `app/utils`: Utility functions
   - `app/contexts`: React context providers
   - `extensions`: Shopify theme extension code

### Database Schema

The database schema is defined in `app/db/schema.ts` and includes tables for:

- **Shops**: Shopify store information
- **Products**: Shopify products enabled for AI generation
- **AI Styles**: Templates for AI image generation
- **Generations**: Records of AI image generations
- **Orders**: Shopify orders
- **Watermarks**: For preview images
- **Quotas**: Usage limits
- **Product Bases**: Templates like "Ceramic Mug", "T-Shirt"
- **Product Base Variants**: Specific configurations with dimensions

### Code Style and Conventions

1. **TypeScript**:
   - Use TypeScript for all new code
   - Define interfaces for data structures
   - Use type inference where appropriate

2. **React Components**:
   - Use functional components with hooks
   - Use Shopify Polaris components for UI consistency
   - Extract reusable logic into custom hooks

3. **API Routes**:
   - Follow the Remix conventions for loader and action functions
   - Use proper error handling and status codes
   - Validate input data

4. **Database Operations**:
   - Use Drizzle ORM for all database operations
   - Define relationships between tables
   - Use transactions for operations that modify multiple tables

### Debugging Tips

1. **Development Mode**:
   - Use `npm run dev:full` to run both the app and extension
   - Check the console for errors and logs

2. **Database Inspection**:
   - Use SQLite tools like DB Browser for SQLite to inspect the database
   - The development database is located at `./dev.sqlite`

3. **API Testing**:
   - The app includes test routes for API functionality
   - Use `/app/styles/$id/test-generation` to test AI generation

4. **Common Issues**:
   - If the app fails to start, check that the database migrations have been applied
   - If Shopify integration fails, verify your API credentials and scopes
