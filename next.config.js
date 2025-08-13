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

  webpack: (config, { isServer }) => {
    // ---- Inject `self` shim into all server entries (runs before vendors) ----
    const originalEntry = config.entry;
    config.entry = async () => {
      const entries = await originalEntry();
      if (isServer) {
        const shim = './polyfills/self.js';
        for (const k of Object.keys(entries)) {
          const v = entries[k];
          if (Array.isArray(v)) {
            if (!v.includes(shim)) entries[k].unshift(shim);
          } else if (typeof v === 'string') {
            entries[k] = [shim, v];
          }
        }
      }
      return entries;
    };

    // Split vendors (your existing optimization)
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

    // Ethers/Node core fallbacks
    config.resolve.fallback = {
      ...config.resolve.fallback,
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

  experimental: {
    esmExternals: true,
    optimizeCss: true,
  },

  async redirects() {
    return [{ source: '/home', destination: '/', permanent: true }];
  },
};

module.exports = nextConfig;
