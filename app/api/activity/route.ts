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
    const { date, exerciseKcal, restingKcal } = body

    if (!date || (exerciseKcal === undefined && restingKcal === undefined)) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const data: { exerciseKcal?: number | null; restingKcal?: number | null } = {}
    if (exerciseKcal !== undefined) data.exerciseKcal = exerciseKcal === null ? null : Number(exerciseKcal)
    if (restingKcal !== undefined) data.restingKcal = restingKcal === null ? null : Number(restingKcal)

    const activity = await prisma.dailyActivity.upsert({
      where: { date },
      update: data,
      create: {
        date,
        exerciseKcal: exerciseKcal !== undefined && exerciseKcal !== null ? Number(exerciseKcal) : null,
        restingKcal: restingKcal !== undefined && restingKcal !== null ? Number(restingKcal) : null,
      },
    })

    return Response.json(activity)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to save activity' }, { status: 500 })
  }
}
