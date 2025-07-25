### Local Development

Running with coudflare tunnel: 

```bash
cloudflared tunnel --url http://localhost:3000
npm run dev -- --tunnel-url=https://criminal-beat-buf-abilities.trycloudflare.com:3000
```

Running with Expose:

```bash
npm run dev:extension
expose share --subdomain=ai-app http://localhost:3000
npm run dev -- --tunnel-url=https://ai-app.eu-1.sharedwithexpose.com:3000
```

Press P to open the URL to your app. Once you click install, you can start development.

Local development is powered by [the Shopify CLI](https://shopify.dev/docs/apps/tools/cli). It logs into your partners account, connects to an app, provides environment variables, updates remote config, creates a tunnel and provides commands to generate extensions.

### Authenticating and querying data

To authenticate and query data you can use the `shopify` const that is exported from `/app/shopify.server.js`:

```js
export async function loader({ request }) {
  const { admin } = await shopify.authenticate.admin(request);

  const response = await admin.graphql(`
    {
      products(first: 25) {
        nodes {
          title
          description
        }
      }
    }`);

  const {
    data: {
      products: { nodes },
    },
  } = await response.json();

  return nodes;
}
```

This template comes preconfigured with examples of:

1. Setting up your Shopify app in [/app/shopify.server.ts](https://github.com/Shopify/shopify-app-template-remix/blob/main/app/shopify.server.ts)
2. Querying data using Graphql. Please see: [/app/routes/app.\_index.tsx](https://github.com/Shopify/shopify-app-template-remix/blob/main/app/routes/app._index.tsx).
3. Responding to webhooks in individual files such as [/app/routes/webhooks.app.uninstalled.tsx](https://github.com/Shopify/shopify-app-template-remix/blob/main/app/routes/webhooks.app.uninstalled.tsx) and [/app/routes/webhooks.app.scopes_update.tsx](https://github.com/Shopify/shopify-app-template-remix/blob/main/app/routes/webhooks.app.scopes_update.tsx)

Please read the [documentation for @shopify/shopify-app-remix](https://www.npmjs.com/package/@shopify/shopify-app-remix#authenticating-admin-requests) to understand what other API's are available.

### App Proxy Authentication

This template includes app proxy routes for storefront integration. App proxies allow your app to serve content through the merchant's domain (e.g., `shop.com/tools/your-app`).

**Configuration:**
- App proxy configured in `shopify.app.toml` with prefix `tools` and subpath `ai-studio`
- Routes accessible via `https://shop.myshopify.com/tools/ai-studio/*`

**Authentication:**
```typescript
// app/routes/api.your-proxy-route.ts
import { authenticate } from "~/shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.public.appProxy(request);
  
  return json({
    success: true,
    shop: session.shop,
    // your data
  });
}
```

**Testing:**
- ✅ Via proxy: `https://your-shop.myshopify.com/tools/ai-studio/api/your-route` (authenticated)
- ❌ Direct: `https://your-tunnel.com/api/your-route` (fails authentication)

## Multi-Environment Setup

This application supports three distinct environments: development, staging, and production. Each environment has its own configuration files and deployment process.

### Environment Overview

| Environment | Purpose | URL | Configuration Files |
|-------------|---------|-----|---------------------|
| Development | Local development and testing | http://localhost:3000 | shopify.app.toml, .env |
| Staging | Testing in a production-like environment | https://ai-generator-app-staging.fly.dev | shopify.app.staging.toml, fly.staging.toml |
| Production | Live application for real users | https://autopictura.fly.dev | shopify.app.production.toml, fly.toml |

### Configuration Files

#### Shopify Configuration

- **Development**: `shopify.app.toml` - Used for local development
- **Staging**: `shopify.app.staging.toml` - Used for the staging environment
- **Production**: `shopify.app.production.toml` - Used for the production environment

#### Fly.io Configuration

- **Staging**: `fly.staging.toml` - Deploys to the staging app on Fly.io
- **Production**: `fly.toml` - Deploys to the production app on Fly.io

### Environment Variables

Each environment requires specific environment variables:

#### Development
- Uses local SQLite database by default
- Environment variables are stored in `.env` file

#### Staging
- Uses Turso database with staging credentials
- Required environment variables in `fly.staging.toml`:
  - `APP_ENV="staging"`
  - `STAGING_TURSO_CONNECTION_URL="libsql://your-staging-database-url.turso.io"`
  - `STAGING_TURSO_AUTH_TOKEN="your-staging-auth-token"`

#### Production
- Uses Turso database with production credentials
- Required environment variables in `fly.toml`:
  - `APP_ENV="production"`
  - `TURSO_CONNECTION_URL="libsql://your-production-database-url.turso.io"`
  - `TURSO_AUTH_TOKEN="your-production-auth-token"`

### Switching Between Environments

Use the following npm scripts to switch between environments:

```bash
# Switch to development environment
npm run config:use:dev

# Switch to staging environment
npm run config:use:staging

# Switch to production environment
npm run config:use:production
```

### Deployment Process

#### Deploying to Staging

```bash
# Deploy the Shopify app to staging
npm run deploy:staging

# Deploy to Fly.io staging
npm run fly:deploy:staging
```

#### Deploying to Production

```bash
# Deploy the Shopify app to production
npm run deploy:production

# Deploy to Fly.io production
npm run fly:deploy:production
```

## Deployment

### Application Storage

This template uses [Drizzle ORM](https://drizzle.team/) to store session data, by default using an [SQLite](https://www.sqlite.org/index.html) database. The database schema is defined in `app/db/schema.ts` using Drizzle's type-safe schema definition.

#### What are Shopify Sessions?

Shopify sessions are critical for maintaining authenticated communication between your app and Shopify. They store:

- **Access Tokens**: OAuth tokens that allow your app to make API calls on behalf of merchants
- **Shop Information**: The specific Shopify store domain and configuration
- **User Data**: Information about the logged-in user (for online sessions)
- **Scope**: The permissions your app has been granted
- **Expiration**: When the session becomes invalid

#### Why Custom Session Storage?

Shopify apps require persistent session storage to:
1. **Maintain Authentication**: Keep users logged in across requests
2. **API Access**: Store access tokens needed for Shopify API calls
3. **Multi-tenant Support**: Handle multiple shop installations
4. **Security**: Securely store sensitive authentication data

#### Drizzle vs Prisma Migration

This template was migrated from Prisma to Drizzle ORM for several benefits:

**Performance & Bundle Size**:
- Drizzle ORM is lighter and faster than Prisma
- Smaller bundle size, better for serverless deployments
- No runtime dependency, better cold start performance

**Type Safety**:
- Compile-time query validation
- Better TypeScript integration
- SQL-like syntax with full type inference

**Cloudflare D1 Ready**:
- Built with future Cloudflare D1 deployment in mind
- Easy migration path from local SQLite to D1
- Serverless-first architecture

#### Official Shopify Drizzle Session Storage

This template uses the official `@shopify/shopify-app-session-storage-drizzle` package which provides a robust, tested implementation of Shopify's `SessionStorage` interface specifically designed for Drizzle ORM.

**Schema Requirements**:
The official package requires a specific database schema format:

```typescript
export const sessionTable = sqliteTable('session', {
  id: text('id').primaryKey(),
  shop: text('shop').notNull(),
  state: text('state').notNull(),
  isOnline: integer('isOnline', {mode: 'boolean'}).notNull().default(false),
  scope: text('scope'),
  expires: text('expires'),
  accessToken: text('accessToken'),
  userId: blob('userId', {mode: 'bigint'}),
});
```

**Setup**:
```typescript
import { DrizzleSessionStorageSQLite } from '@shopify/shopify-app-session-storage-drizzle';
import drizzleDb from './db.server';
import { sessionTable } from './db/schema';

const storage = new DrizzleSessionStorageSQLite(drizzleDb, sessionTable);
```

**Benefits of Official Package**:
- Thoroughly tested by Shopify team
- Handles proper Session class instantiation
- Built-in date/timestamp conversion
- Optimized performance for session operations
- Full compatibility with all Shopify session features

This use of SQLite works in production if your app runs as a single instance.
The database that works best for you depends on the data your app needs and how it is queried.
You can run your database of choice on a server yourself or host it with a SaaS company.

### Build

Remix handles building the app for you, by running the command below with the package manager of your choice:

Using npm:

```shell
npm run build
```

## Development Roadmap

This roadmap outlines the features and tasks required to build the AI Image Generator Shopify App.

### Phase 1: Core Functionality

-   [ ] **Dashboard (`/app`)**
    -   [ ] **Frontend**: Display key stats: current quota usage (generations, storage), recent generations, and quick links.
    -   [ ] **Backend**: Create a loader to fetch data for the dashboard (`quotasTable`, `generationsTable`).

-   [ ] **Products (`/app/products`)**
    -   [ ] **Frontend**: List Shopify products using Polaris `IndexTable`. Add a toggle to enable/disable products for AI generation. Link to a product detail page for managing sizes and styles.
    -   [ ] **Backend**:
        -   [ ] Loader: Fetch products from Shopify and cross-reference with our `productsTable` to show enabled status.
        -   [ ] Action: Handle the enable/disable toggle, creating/updating entries in `productsTable`.

-   [ ] **Product-Specific Management (`/app/products/$id`)**
    -   [ ] **Frontend**: Create a detail page for a single product. This page should have tabs or sections for:
        -   [ ] **Size Management**: CRUD UI for sizes (`sizesTable`) associated with the product.
        -   [ ] **Style Management**: CRUD UI for `styleCollectionsTable` and `aiStylesTable` associated with the product.
    -   [ ] **Backend**:
        -   [ ] Loaders: Fetch all sizes and style collections for the given product.
        -   [ ] Actions: Handle all CRUD operations for sizes and styles.

-   [ ] **Settings (`/app/settings`)**
    -   [ ] **Frontend**:
        -   [ ] **Watermark**: Build a form to upload a watermark image and configure its settings (opacity, position).
        -   [ ] **Quotas**: Display current quota limits and usage.
    -   [ ] **Backend**:
        -   [ ] Action: Handle watermark image upload (to R2) and update the `watermarksTable`.
        -   [ ] Loader: Fetch current settings from `watermarksTable` and `quotasTable`.

### Phase 2: Storefront & Generation Flow

-   [ ] **Storefront App Embed (`Theme App Extension`)**
    -   [ ] **Frontend**: Develop a Preact or vanilla JS component for the App Embed block.
        -   [ ] Fetch sizes and styles for the current product from a new App Proxy endpoint.
        -   [ ] Allow customer to upload an image.
        -   [ ] On form submission, call the backend to generate a preview.
        -   [ ] Update the cart with the generated preview image and custom properties.
    -   [ ] **Backend (`/api/generate`)**:
        -   [ ] Create a new App Proxy route (`/api/generate` or similar).
        -   [ ] Handle image uploads from the storefront.
        -   [ ] Queue a "preview" generation job.
        -   [ ] Return a low-resolution, watermarked image preview.

-   [ ] **Webhooks (`/webhooks`)**
    -   [ ] **`ORDERS_CREATE`**: Implement the webhook to trigger high-resolution generation.
        -   [ ] Parse the order to find relevant line items.
        -   [ ] Create an entry in the `ordersTable`.
        -   [ ] Enqueue a "final" generation job in Cloudflare Queues.
    -   [ ] **`APP_UNINSTALLED`**: Implement the webhook to handle app uninstallation (e.g., set `shopsTable.isActive = false`).

-   [ ] **Background Jobs (`Cloudflare Queues`)**
    -   [ ] **Preview Worker**: Process low-res preview generations.
    -   [ ] **Final Worker**: Process high-res, non-watermarked final image generations.
        -   [ ] Update the `generationsTable` with the final image URL and status.

### Phase 3: Management & Analytics

-   [ ] **Generations (`/app/generations`)**
    -   [ ] **Frontend**: Display a paginated table of all generation records from `generationsTable`. Include status, preview, and links to the product/order.
    -   [ ] **Backend**: Create a loader to fetch and paginate generations, including related data.

-   [ ] **Orders (`/app/orders`)**
    -   [ ] **Frontend**: Display a list of Shopify orders that used the AI generator. Link to the final downloadable image.
    -   [ ] **Backend**: Loader to fetch data from `ordersTable`, cross-referencing with `generationsTable`.

-   [ ] **Analytics (`/app/analytics`)**
    -   [ ] **Frontend**: Create charts and dashboards to visualize data (e.g., generation counts, popular styles).
    -   [ ] **Backend**: Create loaders that aggregate data from the database for the analytics view.

-   [ ] **Download Center (`/app/downloads`)**
    -   [ ] **Frontend**: Provide a simple interface for merchants to search and download their final high-resolution images.
    -   [ ] **Backend**: Securely serve files from Cloudflare R2.

## Benefits

Shopify apps are built on a variety of Shopify tools to create a great merchant experience.

<!-- TODO: Uncomment this after we've updated the docs -->
<!-- The [create an app](https://shopify.dev/docs/apps/getting-started/create) tutorial in our developer documentation will guide you through creating a Shopify app using this template. -->

The Remix app template comes with the following out-of-the-box functionality:

- [OAuth](https://github.com/Shopify/shopify-app-js/tree/main/packages/shopify-app-remix#authenticating-admin-requests): Installing the app and granting permissions
- [GraphQL Admin API](https://github.com/Shopify/shopify-app-js/tree/main/packages/shopify-app-remix#using-the-shopify-admin-graphql-api): Querying or mutating Shopify admin data
- [Webhooks](https://github.com/Shopify/shopify-app-js/tree/main/packages/shopify-app-remix#authenticating-webhook-requests): Callbacks sent by Shopify when certain events occur
- [AppBridge](https://shopify.dev/docs/api/app-bridge): This template uses the next generation of the Shopify App Bridge library which works in unison with previous versions.
- [Polaris](https://polaris.shopify.com/): Design system that enables apps to create Shopify-like experiences

## Tech Stack

This template uses [Remix](https://remix.run). The following Shopify tools are also included to ease app development:

- [Shopify App Remix](https://shopify.dev/docs/api/shopify-app-remix) provides authentication and methods for interacting with Shopify APIs.
- [Shopify App Bridge](https://shopify.dev/docs/apps/tools/app-bridge) allows your app to seamlessly integrate your app within Shopify's Admin.
- [Polaris React](https://polaris.shopify.com/) is a powerful design system and component library that helps developers build high quality, consistent experiences for Shopify merchants.
- [Webhooks](https://github.com/Shopify/shopify-app-js/tree/main/packages/shopify-app-remix#authenticating-webhook-requests): Callbacks sent by Shopify when certain events occur
- [Polaris](https://polaris.shopify.com/): Design system that enables apps to create Shopify-like experiences

## Migration from Prisma to Drizzle ORM

This template has been migrated from Prisma to Drizzle ORM for better performance, smaller bundle size, and Cloudflare D1 compatibility.

### Key Files Changed

#### Database Configuration
- **`drizzle.config.ts`** - Drizzle configuration for migrations and database connection
- **`app/db/schema.ts`** - Database schema definition using Drizzle syntax
- **`app/db.server.ts`** - Database client setup with better-sqlite3 and Drizzle
- **`app/db/migrations/`** - Generated migration files

#### Session Storage
- **`app/session-storage.server.ts`** - Custom DrizzleSessionStorage implementation
- **`app/shopify.server.ts`** - Updated to use DrizzleSessionStorage

#### Configuration Updates  
- **`package.json`** - Updated dependencies and scripts
- **`shopify.web.toml`** - Updated predev commands for Drizzle
- **`.gitignore`** - Updated patterns for Drizzle files

### Important Implementation Notes

#### Session Instance Creation
The most critical aspect of the migration was ensuring that `loadSession()` returns proper Shopify `Session` class instances rather than plain objects:

```typescript
// ❌ Wrong - returns plain object (causes session.isActive errors)
return {
  id: sessionData.id,
  shop: sessionData.shop,
  // ... other properties
};

// ✅ Correct - returns Session instance with all methods
return new Session({
  id: sessionData.id,
  shop: sessionData.shop,
  expires: sessionData.expires ? new Date(sessionData.expires) : undefined,
  // ... other properties
});
```

#### Date Handling
Sessions store expiration as Date objects, but the database stores them as timestamps:

```typescript
// Storing: Convert Date to timestamp
expires: session.expires ? new Date(session.expires).getTime() : null

// Loading: Convert timestamp back to Date
expires: sessionData.expires ? new Date(sessionData.expires) : undefined
```

### Migration Benefits

1. **Performance**: Faster queries and smaller runtime footprint
2. **Type Safety**: Compile-time SQL validation and better TypeScript support  
3. **Bundle Size**: Significantly smaller than Prisma
4. **Serverless Ready**: Perfect for Cloudflare Workers and D1
5. **SQL-like**: More familiar syntax for developers who know SQL

### Production Database Options

#### Turso Database Integration

This app now supports using [Turso](https://turso.tech) in production environments. Turso is a distributed database built on libSQL (a fork of SQLite) that provides:

- Global distribution with low latency
- SQLite compatibility
- Serverless-friendly architecture
- High performance and reliability

The app automatically uses:
- **Development**: Local SQLite database
- **Production**: Turso database (when configured)

**Configuration:**

1. Create a Turso database using their CLI or dashboard
2. Set the following environment variables in your production environment:
   ```
   TURSO_CONNECTION_URL=https://your-database-name.turso.io
   TURSO_AUTH_TOKEN=your-auth-token
   ```
3. Deploy your app

The database configuration in `app/db.server.ts` will automatically detect the production environment and use Turso instead of SQLite.

**Migration Support:**

The `drizzle.config.ts` file has been updated to support Turso for migrations in production. When running migrations in a production environment with Turso configured, it will use the Turso connection details.

#### Future Cloudflare D1 Migration

To deploy to Cloudflare D1 in the future:

1. Update `app/db.server.ts` to use D1 bindings in production
2. Use `wrangler d1 create` to create your D1 database
3. Run migrations using `wrangler d1 migrations apply`
4. Deploy with `wrangler deploy`

The current schema and DrizzleSessionStorage implementation is fully compatible with D1.

## Resources

- [Remix Docs](https://remix.run/docs/en/v1)
- [Shopify App Remix](https://shopify.dev/docs/api/shopify-app-remix)
- [Drizzle ORM Documentation](https://drizzle.team/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Introduction to Shopify apps](https://shopify.dev/docs/apps/getting-started)
- [App authentication](https://shopify.dev/docs/apps/auth)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- [App extensions](https://shopify.dev/docs/apps/app-extensions/list)
- [Shopify Functions](https://shopify.dev/docs/api/functions)
- [Getting started with internationalizing your app](https://shopify.dev/docs/apps/best-practices/internationalization/getting-started)
