import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // The transcoder and ZIP routes read logo files off disk at request time.
  outputFileTracingIncludes: {
    '/api/logos/**': ['./public/logos/**', './public/badges/**'],
    '/api/badges/**': ['./public/badges/**'],
    '/api/mcp': ['./public/logos/**', './public/badges/**'],
    '/api/[transport]': ['./public/logos/**', './public/badges/**'],
  },
};

export default nextConfig;
