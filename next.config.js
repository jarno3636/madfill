webpack: (config, { isServer, webpack }) => {
  // Keep your existing optimization and fallbacks
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

  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    net: false,
    tls: false,
  };

  // --- Ensure `self` exists as an identifier on server at compile-time ---
  if (isServer) {
    config.plugins.push(
      new webpack.DefinePlugin({
        // define as an identifier, not a string literal
        self: 'globalThis',
      })
    );
  }

  // --- HARDEN: alias browser-only deps to stubs on the server build ---
  // This prevents them from ever entering the server vendors.js chunk.
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    ...(isServer
      ? {
          // Known offenders / likely offenders
          'react-confetti': require('path').resolve(__dirname, 'stubs/ConfettiStub.js'),
          'canvas-confetti': require('path').resolve(__dirname, 'stubs/empty-module.js'),
          'dom-confetti': require('path').resolve(__dirname, 'stubs/empty-module.js'),
          // add more here if you see other browser-only libs crash SSR
        }
      : {}),
  };

  // --- Also inject a tiny runtime shim very early (belt-and-suspenders) ---
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

  return config;
},
