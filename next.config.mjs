import { withSerwist } from "@serwist/turbopack";

/**
 * Section 65 — PWA shell.
 * Using Serwist with Turbopack.
 */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  allowedDevOrigins: ['192.168.1.29', '192.168.*.*', 'localhost'],
  images: {
    // Allowed external domains for Next.js Image component
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google avatars
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
    // Output WebP/AVIF for modern browsers — much smaller than PNG/JPEG
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images for 30 days
    minimumCacheTTL: 2592000,
  },
};

export default withSerwist(nextConfig);
