import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Only run during production builds. Next.js 16 uses Turbopack for `next dev`
  // which is incompatible with serwist's webpack integration; the service worker
  // is not needed during local development anyway.
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  experimental: {
    // Next.js buffers request bodies so both middleware (auth check) and the route
    // handler can read them. Default is 10MB — raise it to cover Expert Capture
    // video uploads (up to 500MB). This only affects local dev and self-hosted;
    // on Vercel serverless, large uploads should use direct-to-Blob presigned URLs.
    middlewareClientMaxBodySize: "500mb",
  },
};

export default withSerwist(nextConfig);
