import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const date = searchParams.get('date')

    if (date) {
      const log = await prisma.weightLog.findUnique({ where: { date } })
      return Response.json(log)
    }

    const logs = await prisma.weightLog.findMany({ orderBy: { date: 'desc' } })
    return Response.json(logs)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to fetch weight' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, weight } = body

    if (!date || weight === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const log = await prisma.weightLog.upsert({
      where: { date },
      update: { weight: Number(weight) },
      create: { date, weight: Number(weight) },
    })

    return Response.json(log)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to save weight' }, { status: 500 })
  }
}
