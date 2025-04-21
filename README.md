# Supabase Authentication App

A Next.js application with Supabase authentication, using the App Router and Server Components.

## Features

- Next.js 15+ with App Router
- Supabase Authentication (Email/Password)
- TypeScript
- Server Components and Client Components
- Middleware for protected routes
- Environment variable management
- Responsive design with Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd supabase-auth-app
```

2. Install dependencies:

```bash
npm install
# or
pnpm install
```

3. Create a `.env.local` file in the root directory with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

You can get these values from your Supabase dashboard under **Project Settings > API**.

4. Run the development server:

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

## Project Structure

- `app/` - Next.js App Router pages
- `app/api/` - API routes
- `app/auth/` - Authentication pages (login, signup)
- `app/dashboard/` - Protected dashboard page
- `lib/` - Utility functions and Supabase client setup
- `middleware.ts` - Next.js middleware for protected routes

## Deployment

### 1. Supabase Project Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Set up authentication in your Supabase dashboard:
   - Enable email/password authentication
   - Configure redirect URLs (add your production domain)

### 2. Environment Variables

For production deployment, you'll need to set these environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SITE_URL=your-production-url
```

### 3. Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Set the environment variables in the Vercel dashboard
4. Deploy the application

### 4. Configure Supabase Auth URL

After deployment:

1. Go to your Supabase dashboard
2. Navigate to **Authentication > URL Configuration**
3. Set the Site URL to your deployed application URL
4. Add any additional redirect URLs if needed

## Next Steps

Some ideas to expand this project:

- Add social auth providers (Google, GitHub, etc.)
- Implement user profile management
- Add password reset functionality
- Create more complex protected routes
- Add database tables with Row Level Security

## Troubleshooting

- **Authentication issues**: Make sure your redirect URLs are correctly set in Supabase
- **Deployment errors**: Check that all environment variables are correctly set
- **NextJS errors**: Ensure you're using compatible versions of all dependencies

## License

This project is licensed under the MIT License.
