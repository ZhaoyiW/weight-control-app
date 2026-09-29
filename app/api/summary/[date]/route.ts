import { prisma } from '@/lib/prisma'
import { calcDailySummary } from '@/lib/summary'
import { getTrailing7DayAverages } from '@/lib/activityAverages'
import { NextRequest } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params

    const [profile, weightLog, meals, activity, avgs] = await Promise.all([
      prisma.userProfile.findUnique({ where: { id: 1 } }),
      prisma.weightLog.findUnique({ where: { date } }),
      prisma.mealEntry.findMany({ where: { date } }),
      prisma.dailyActivity.findUnique({ where: { date } }),
      getTrailing7DayAverages(date),
    ])

    let weight = weightLog?.weight ?? null
    let weightEstimated = false

    if (!weightLog) {
      // Try to find the most recent weight before this date
      const latest = await prisma.weightLog.findFirst({
        where: { date: { lt: date } },
        orderBy: { date: 'desc' },
      })
      if (latest) {
        weight = latest.weight
        weightEstimated = true
      }
    }

    const totalIntake = meals.reduce((sum: number, m: { kcal: number }) => sum + m.kcal, 0)
    const exerciseKcal = activity?.exerciseKcal ?? null
    const restingKcal = activity?.restingKcal ?? null

    const summary = calcDailySummary({
      date,
      profile,
      weight,
      weightEstimated,
      exerciseKcal,
      restingKcal,
      ...avgs,
      totalIntake,
    })

    return Response.json(summary)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to fetch summary' }, { status: 500 })
  }
}
