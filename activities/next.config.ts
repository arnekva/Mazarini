import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // This app lives inside the bot's monorepo, which has its own root-level package-lock.json.
  // Pin the workspace root here so Next doesn't try to infer it from that outer lockfile.
  turbopack: {
    root: path.join(__dirname),
  },
}

export default nextConfig
