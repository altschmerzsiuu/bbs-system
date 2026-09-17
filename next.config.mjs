import { withSerwist } from "@serwist/turbopack";

/**
 * Section 65 — PWA shell.
 * Using Serwist with Turbopack.
 */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
};

export default withSerwist(nextConfig);
