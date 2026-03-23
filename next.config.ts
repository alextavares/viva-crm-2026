import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid Next.js picking an incorrect workspace root when multiple lockfiles exist.
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      {
        source: '/agenda',
        destination: '/appointments',
        permanent: true,
      },
    ];
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
