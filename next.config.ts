import type { NextConfig } from "next";

/**
 * Turbopack must resolve from the real app folder. With a path like
 * `.../Cursor/Side Quest App`, `import.meta.url` / `__dirname` for this file can
 * resolve incorrectly after compilation; `process.cwd()` matches `npm run dev`.
 */
const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
  ],
};

export default nextConfig;
