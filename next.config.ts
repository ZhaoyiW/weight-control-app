import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // A stray package-lock.json in the home directory makes Turbopack infer
  // the wrong workspace root, and `@import "tailwindcss"` then fails to
  // resolve in an endless retry loop that exhausts processes.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
