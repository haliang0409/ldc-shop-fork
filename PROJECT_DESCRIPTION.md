# LDC Shop - Project Description

## Overview

**LDC Shop** is a modern, serverless e-commerce platform designed for virtual goods distribution. Built with cutting-edge web technologies, it provides a complete solution for automated digital product delivery with integrated payment processing and user authentication through the Linux DO ecosystem.

## Project Purpose

This platform enables merchants to sell digital products (such as license keys, activation codes, vouchers, etc.) with fully automated delivery. It eliminates manual processing by automatically distributing purchased items immediately after successful payment, making it ideal for selling software licenses, game keys, subscription codes, and other virtual goods.

## Architecture

The project offers **two deployment architectures**:

### 1. Next.js Edition (Primary)
- **Framework**: Next.js 16 with App Router
- **Database**: Vercel Postgres (PostgreSQL)
- **ORM**: Drizzle ORM
- **Hosting**: Vercel platform
- **Location**: Root directory

### 2. Cloudflare Workers Edition
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Hosting**: Cloudflare Edge Network
- **Location**: `_workers_v2/` directory

## Key Features

### Storefront Capabilities
- **Product Catalog**: Browse products with search and category filtering
- **Rich Descriptions**: Markdown-formatted product details
- **Stock Management**: Real-time inventory and sales counters
- **Ratings & Reviews**: Customer feedback from verified purchasers
- **Purchase Limits**: Control maximum purchases per customer
- **Announcement System**: Configurable homepage announcements

### Payment & Order Processing
- **Linux DO Credit Integration**: Native payment processing via EasyPay protocol
- **Automatic Delivery**: Instant card key distribution on successful payment
- **Stock Reservation**: 1-minute inventory lock during checkout
- **Auto-Cancellation**: Unpaid orders automatically cancelled after 5 minutes
- **Callback Verification**: Signature and amount validation for security
- **Order Management**: Complete order tracking and history

### Admin Dashboard
- **Sales Analytics**: Dashboard with today/week/month/total statistics
- **Product Management**: Create, edit, enable/disable, reorder products
- **Inventory Control**: Bulk import and manage card keys/codes
- **Order Processing**: View orders and handle refunds
- **Review Moderation**: Manage customer reviews
- **Data Export**: Export orders, products, and reviews to CSV/JSON/SQL
- **Settings**: Configure store name and other parameters

### User Experience
- **Authentication**: Linux DO Connect (OIDC) single sign-on
- **Internationalization**: English and Chinese language support
- **Theme Support**: Light/dark/system theme modes
- **Responsive Design**: Mobile-friendly interface
- **Social Sharing**: Share products on X/Twitter, Facebook, Telegram, WhatsApp, Line

## Technology Stack

### Frontend
- **Next.js 16**: React framework with App Router
- **React 19**: UI library
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Shadcn UI**: Component library built on Radix UI
- **Lucide React**: Icon system
- **React Markdown**: Markdown rendering

### Backend
- **Next.js API Routes**: Serverless API endpoints
- **NextAuth.js v5**: Authentication framework
- **Drizzle ORM**: Type-safe database queries
- **Vercel Postgres**: Managed PostgreSQL database

### Development Tools
- **TypeScript 5**: Static type checking
- **ESLint**: Code linting
- **Drizzle Kit**: Database migrations
- **Vercel CLI**: Deployment and environment management

## Database Schema

The application uses a relational database with the following main tables:

- **products**: Product catalog with pricing and metadata
- **cards**: Inventory of card keys/codes for each product
- **orders**: Purchase transactions and order status
- **reviews**: Customer ratings and reviews
- **login_users**: User visit tracking
- **settings**: System configuration

## Deployment Options

### Option 1: Vercel (Recommended for Next.js)
1. One-click deployment using the Vercel button
2. Automatic Vercel Postgres database provisioning
3. Configure environment variables for Linux DO integration
4. **Important**: Bind a custom domain (required for payment callbacks)

### Option 2: Cloudflare Workers
1. Use Wrangler CLI for deployment
2. Create and configure D1 database
3. Set environment secrets
4. Deploy to Cloudflare edge network

## Environment Requirements

### Required Environment Variables
- `OAUTH_CLIENT_ID`: Linux DO Connect OAuth client ID
- `OAUTH_CLIENT_SECRET`: Linux DO Connect OAuth secret
- `MERCHANT_ID`: Linux DO Credit merchant ID
- `MERCHANT_KEY`: Linux DO Credit merchant secret
- `ADMIN_USERS`: Comma-separated list of admin usernames
- `NEXT_PUBLIC_APP_URL`: Public application URL

### Database
- PostgreSQL (Vercel Postgres) for Next.js version
- SQLite (Cloudflare D1) for Workers version

## Security Features

- **Payment Verification**: Cryptographic signature validation
- **CSRF Protection**: Cross-site request forgery prevention
- **Secure Authentication**: OAuth 2.0/OIDC via Linux DO Connect
- **Environment Isolation**: Separate production/development configurations
- **Input Validation**: Server-side validation of all user inputs

## Local Development

```bash
# Install dependencies
npm install

# Link to Vercel project (for environment variables)
vercel link
vercel env pull .env.development.local

# Run database migrations
npx drizzle-kit push

# Start development server
npm run dev
```

## Project Statistics

- **Total TypeScript Code**: ~6,200 lines
- **Tech Stack**: Next.js 16, React 19, TypeScript 5
- **Database**: Drizzle ORM with PostgreSQL
- **UI Framework**: Tailwind CSS + Shadcn UI

## Important Notes

1. **Custom Domain Required**: Do not use default `*.vercel.app` domains in production due to payment callback blocking issues
2. **Refund API Limitations**: Linux DO Credit refund API requires client-side browser calls due to WAF protection
3. **Linux DO Ecosystem**: Designed specifically for integration with Linux DO services
4. **Serverless Architecture**: No server maintenance required

## Documentation

- **Main README**: [README.md](./README.md) (Chinese)
- **English README**: [README_EN.md](./README_EN.md)
- **Workers Version**: [_workers_v2/README.md](./_workers_v2/README.md)

## License

MIT License - See LICENSE file for details

## Repository

- **Fork**: haliang0409/ldc-shop-fork
- **Original**: chatgptuk/ldc-shop
