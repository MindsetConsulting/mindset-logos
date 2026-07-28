import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // The transcoder and ZIP routes read logo files off disk at request time.
  outputFileTracingIncludes: {
    '/api/logos/**': ['./public/logos/**'],
  },
};

export default nextConfig;
