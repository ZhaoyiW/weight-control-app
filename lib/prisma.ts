import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  // Each serverless instance keeps its own pool, and Supabase's pooler caps
  // clients at 200 in total, so keep the pool small and close idle
  // connections quickly instead of the pg defaults (10, kept for 10s).
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: 3,
    idleTimeoutMillis: 3000,
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
