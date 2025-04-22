/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
    // Add Supabase storage domain if you're using it for images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qsuqkrovwperocnbxeni.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Add any additional headers for security
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  experimental: {
    serverComponentsExternalPackages: ['@supabase/ssr'],
  },
};

module.exports = nextConfig; 