import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // Required for `prisma migrate` / Studio; use your hosting DB in prod (e.g. Neon).
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/sidequest",
  },
});
