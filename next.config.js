// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@farcaster/miniapp-sdk', '@farcaster/frame-sdk'],
  async redirects() {
    return [
      // optional: if you use Farcaster Hosted Manifest later
      // {
      //   source: '/.well-known/farcaster.json',
      //   destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/YOUR_ID',
      //   permanent: false,
      // },
    ]
  },
}

module.exports = nextConfig
