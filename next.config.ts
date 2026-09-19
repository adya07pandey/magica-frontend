import type { NextConfig } from "next";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:3000";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ?? DEFAULT_BACKEND_URL;

    return [
      {
        source: "/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
