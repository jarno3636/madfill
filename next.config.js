/* eslint-disable @typescript-eslint/no-var-requires */
/** @type {import('next').NextConfig} */
const path = require('path');
const webpackLib = require('webpack');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',

  // Images used by OGs / Warpcast cards / CDN assets
  images: {
    domains: ['warpcast.com', 'imagedelivery.net', 'res.cloudinary.com', 'madfill.vercel.app'],
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  // HTTP headers (mirrors your security/CDN needs)
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
    // Ensure UMD builds and any libs that expect `self` work on SSR
    config.output = config.output || {};
    config.output.globalObject = 'globalThis';

    // Keep your manual vendor splitting (optional; Next has sane defaults)
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

    // Disable Node core polyfills in browser bundles
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      net: false,
      tls: false,
    };

    if (isServer) {
      // Compile-time alias for `self` so server-side vendor code doesn't crash
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpackLib.DefinePlugin({
          self: 'globalThis',
        })
      );

      // Runtime guard – in case any chunk still probes `self`
      config.plugins.push(
        new webpackLib.BannerPlugin({
          raw: true,
          entryOnly: false,
          banner:
            'try{if(typeof globalThis!=="undefined"&&typeof globalThis.self==="undefined"){globalThis.self=globalThis}}catch(e){}',
        })
      );
    }

    // Stub browser-only deps on the server to avoid SSR imports executing
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

    // Prepend our explicit SSR polyfill to all server entries (defensive)
    const originalEntry = typeof config.entry === 'function' ? config.entry : async () => config.entry || {};
    config.entry = async () => {
      const entries = await originalEntry();
      if (isServer) {
        const shimPath = path.resolve(__dirname, 'polyfills/self.js');
        for (const key of Object.keys(entries || {})) {
          const val = entries[key];
          if (Array.isArray(val)) {
            if (!val.includes(shimPath)) entries[key] = [shimPath, ...val];
          } else if (typeof val === 'string') {
            entries[key] = [shimPath, val];
          }
        }
      }
      return entries;
    };

    return config;
  },

  // Public env only (safe—no secrets)
  env: {
    NEXT_PUBLIC_APP_NAME: 'MadFill',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },

  experimental: {
    esmExternals: true,
    optimizeCss: true,
  },

  async redirects() {
    return [{ source: '/home', destination: '/', permanent: true }];
  },
};

module.exports = nextConfig;
