import path from "node:path";
import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const distDir = process.env.NEXT_DIST_DIR || (isDevelopment ? ".next-dev" : ".next");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep dev and verification artifacts isolated so a verification build does not break a running dev server.
  distDir,
  outputFileTracingRoot: path.join(__dirname, ".."),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "places.googleapis.com"
      },
      {
        protocol: "https",
        hostname: "maps.gstatic.com"
      }
    ]
  }
};

export default nextConfig;
