import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const logs = await prisma.weightLog.findMany({
      orderBy: { date: 'desc' },
      take: 30,
    })
    return Response.json(logs)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to fetch weight history' }, { status: 500 })
  }
}
