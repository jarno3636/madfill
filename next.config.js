/* eslint-disable @typescript-eslint/no-var-requires */
/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',

  images: {
    domains: ['warpcast.com', 'imagedelivery.net', 'res.cloudinary.com', 'madfill.vercel.app'],
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://warpcast.com https://*.warpcast.com;",
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
        ],
      },
      {
        source: '/.well-known/farcaster.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=300' },
        ],
      },
    ];
  },

  // Keep webpack minimal; do not mutate server chunking/polyfills
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },

  env: {
    NEXT_PUBLIC_APP_NAME: 'MadFill',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },

  // Remove optimizeCss (pulls in critters during export)
  experimental: {
    esmExternals: true,
    // optimizeCss: true, // ❌ remove; causes “Cannot find module 'critters'”
  },

  async redirects() {
    return [
      { source: '/home', destination: '/', permanent: true },
      { source: '/leaderboard', destination: '/', permanent: true }, // remove dead route
    ];
  },
};

module.exports = nextConfig;
