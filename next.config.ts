import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel uses its native Next.js output; standalone is used by the Docker image.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
};

export default nextConfig;
