import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add it in .env (local) or in Vercel project settings.");
  }
  return url;
}

function createPrismaClient(): PrismaClient {
  const connectionString = getConnectionString();
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

// Reuse one client in dev and on Vercel (avoids opening too many DB connections per invocation).
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = createPrismaClient();
}
export const prisma = globalForPrisma.prisma;
