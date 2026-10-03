import type { NextConfig } from 'next';

// Deployment assumption: frontend (BFF) and API run together, behind one reverse proxy, and the
// browser only ever talks to the frontend. Nothing here needs configuring for that: the proxy
// switch is the runtime env var TRUST_PROXY (read per request in src/helpers/utils.ts `clientIp`, never inlined at
// build time, so one image works everywhere). See docs/deployment.md §5.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev server reached via the LAN IP (phone/QR pairing); extra hosts: DEV_ORIGINS=a,b
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(',') ?? [],
  logging: {
    fetches: {
      fullUrl: true
    }
  }
};

export default nextConfig;
