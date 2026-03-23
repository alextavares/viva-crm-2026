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
};

export default nextConfig;
