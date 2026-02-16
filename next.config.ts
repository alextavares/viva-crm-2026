import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid Next.js picking an incorrect workspace root when multiple lockfiles exist.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
