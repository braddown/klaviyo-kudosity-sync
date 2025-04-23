# Klaviyo-Kudosity Sync

A Next.js application for syncing data between Klaviyo and Kudosity platforms.

## Overview

This application allows for seamless data synchronization between Klaviyo (email marketing platform) and Kudosity (SMS marketing via Transmit SMS). It provides a user interface for managing contact transfers, field mappings, and monitoring sync operations.

## Features

- **Authenticated API Integration**: Secure connections to both Klaviyo and Kudosity APIs
- **Bulk Contact Import**: Efficiently transfer contacts from Klaviyo segments/lists to Kudosity SMS lists
- **Field Mapping**: Customize how data fields map between platforms
- **Progress Monitoring**: Real-time tracking of sync operations
- **CSV Export**: Generate and store contact data in CSV format
- **List Management**: Create and manage Kudosity lists directly from the UI
- **Supabase Integration**: User authentication and data storage

## Setup

### Prerequisites

- Node.js 18+ and npm/pnpm
- Supabase account
- Klaviyo API credentials
- Kudosity (Transmit SMS) API credentials

### Installation

1. Clone the repository
```bash
git clone [repository-url]
cd klaviyo-kudosity-sync
```

2. Install dependencies
```bash
npm install
# or
pnpm install
```

3. Set up environment variables
Create a `.env.local` file with the following variables:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Run the development server
```bash
npm run dev
# or
pnpm dev
```

## Configuration

1. **Supabase Setup**:
   - Create a `api_settings` table to store API credentials
   - Set up a `kudosity_imports` table to track import operations
   - Create a `Temporary CSV exports for Klaviyo-Kudosity sync` storage bucket for CSV files

2. **API Credentials**:
   - Configure Klaviyo API key in settings
   - Configure Kudosity username and password in settings

## Usage

1. **Login/Authentication**: Sign in with your Supabase account
2. **API Settings**: Configure your Klaviyo and Kudosity API credentials
3. **Data Sync**:
   - Select a Klaviyo segment or list as the source
   - Select or create a Kudosity list as the destination
   - Configure field mappings between platforms
   - Start the sync process
   - Monitor progress in real-time

## Technologies

- **Frontend**: React, Next.js, Tailwind CSS, Radix UI
- **Backend**: Next.js API routes, Supabase
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Styling**: Tailwind CSS with class-variance-authority
- **Type Safety**: TypeScript

## Development

### Project Structure

- `/app`: Next.js app router pages and API routes
- `/components`: React components
- `/lib`: Utility functions and API clients
- `/scripts`: Helper scripts

### Commands

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint

## Resources

- [Kudosity API Documentation](https://developers.kudosity.com/reference/post_add-contacts-bulk-json)
- [Klaviyo API Documentation](https://developers.klaviyo.com/en/reference)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.io/docs)

## License

ISC
