/* eslint-disable @typescript-eslint/no-var-requires */
/** @type {import('next').NextConfig} */
const path = require('path');
const webpackLib = require('webpack');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',

  images: {
    domains: [
      'warpcast.com',
      'imagedelivery.net',
      'res.cloudinary.com',
      'madfill.vercel.app',
    ],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
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

  webpack: (config, { isServer }) => {
    // ----- code splitting (keep your previous settings) -----
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    };

    // polyfills for node core modules some libs try to import
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Provide `self` as an identifier on the server (compile-time)
    if (isServer) {
      config.plugins.push(
        new webpackLib.DefinePlugin({
          self: 'globalThis',
        })
      );
    }

    // Server-only aliases to prevent browser-only libs from entering the server bundle
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      ...(isServer
        ? {
            'react-confetti': path.resolve(__dirname, 'stubs/ConfettiStub.js'),
            'canvas-confetti': path.resolve(__dirname, 'stubs/empty-module.js'),
            'dom-confetti': path.resolve(__dirname, 'stubs/empty-module.js'),
          }
        : {}),
    };

    // Inject a tiny runtime shim early on server entries (belt & suspenders)
    const originalEntry = config.entry;
    config.entry = async () => {
      const entries = await originalEntry();
      if (isServer) {
        const shimPath = path.resolve(__dirname, 'polyfills/self.js');
        for (const key of Object.keys(entries)) {
          const val = entries[key];
          if (Array.isArray(val)) {
            if (!val.includes(shimPath)) entries[key].unshift(shimPath);
          } else if (typeof val === 'string') {
            entries[key] = [shimPath, val];
          }
        }
      }
      return entries;
    };

    return config;
  },

  env: {
    NEXT_PUBLIC_APP_NAME: 'MadFill',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },

  experimental: {
    esmExternals: true,
    optimizeCss: true,
  },

  async redirects() {
    return [
      { source: '/home', destination: '/', permanent: true },
    ];
  },
};

module.exports = nextConfig;
