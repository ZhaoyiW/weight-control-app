import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const date = searchParams.get('date')

    if (!date) {
      return Response.json({ error: 'date parameter required' }, { status: 400 })
    }

    const activity = await prisma.dailyActivity.findUnique({ where: { date } })
    return Response.json(activity)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, exerciseKcal } = body

    if (!date || exerciseKcal === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const activity = await prisma.dailyActivity.upsert({
      where: { date },
      update: { exerciseKcal: Number(exerciseKcal) },
      create: { date, exerciseKcal: Number(exerciseKcal) },
    })

    return Response.json(activity)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to save activity' }, { status: 500 })
  }
}
