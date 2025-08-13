// polyfills/self.js
// Ensure `self` exists during SSR so browser-y libs don't crash.
if (typeof self === 'undefined') {
  // Node has globalThis; attach `self` to it for server runtime only.
  // eslint-disable-next-line no-undef
  global.self = globalThis;
}
