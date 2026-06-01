import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@hotel-pms/shared", "@hotel-pms/ui"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
