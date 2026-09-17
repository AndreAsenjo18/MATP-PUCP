import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image (see apps/web/Dockerfile).
  output: "standalone",
  // npm workspaces hoist dependencies to the repository root.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
