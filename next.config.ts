import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next.js buffers request bodies so both middleware (auth check) and the route
    // handler can read them. Default is 10MB — raise it to cover Expert Capture
    // video uploads (up to 500MB). This only affects local dev and self-hosted;
    // on Vercel serverless, large uploads should use direct-to-Blob presigned URLs.
    middlewareClientMaxBodySize: "500mb",
  },
};

export default nextConfig;
