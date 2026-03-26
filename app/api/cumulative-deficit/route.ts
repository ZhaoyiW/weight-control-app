import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'
import { calcBMR } from '@/lib/bmr'

function calcAge(birthday: string): number {
  const today = new Date()
  const dob = new Date(birthday)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const date = searchParams.get('date')
    if (!date) return Response.json({ error: 'date required' }, { status: 400 })

    const profile = await prisma.userProfile.findUnique({ where: { id: 1 } })
    const age = profile?.birthday ? calcAge(profile.birthday) : null
    const profileComplete = !!(profile?.gender && age && profile?.height)
    if (!profileComplete) {
      return Response.json({ cumulativeDeficit: null, days: 0 })
    }

    // Collect all dates with any meal or activity data up to selected date
    const from = searchParams.get('from')

    const [mealRows, activities, weightLogs] = await Promise.all([
      prisma.mealEntry.groupBy({
        by: ['date'],
        where: { date: { lte: date, ...(from ? { gte: from } : {}) } },
        _sum: { kcal: true },
      }),
      prisma.dailyActivity.findMany({
        where: { date: { lte: date, ...(from ? { gte: from } : {}) } },
        select: { date: true, exerciseKcal: true },
      }),
      // Weight logs: fetch from beginning (needed for lookback before `from`)
      prisma.weightLog.findMany({
        where: { date: { lte: date } },
        orderBy: { date: 'asc' },
        select: { date: true, weight: true },
      }),
    ])

    // Build lookup maps
    const intakeByDate = new Map(mealRows.map((r) => [r.date, r._sum.kcal ?? 0]))
    const exerciseByDate = new Map(activities.map((a) => [a.date, a.exerciseKcal]))

    // All dates that have intake data
    const allDates = [...new Set([...intakeByDate.keys()])].sort()

    // Helper: find most recent weight on or before a date
    function weightOn(d: string): number | null {
      let w: number | null = null
      for (const log of weightLogs) {
        if (log.date <= d) w = log.weight
        else break
      }
      return w
    }

    let cumulativeDeficit = 0
    let days = 0

    for (const d of allDates) {
      const weight = weightOn(d)
      if (weight === null || !profile) continue

      const bmr = calcBMR(profile.gender, age!, profile.height, weight)
      const exercise = exerciseByDate.get(d) ?? 0
      const burn = bmr + exercise
      const intake = intakeByDate.get(d) ?? 0
      cumulativeDeficit += intake - burn
      days++
    }

    return Response.json({
      cumulativeDeficit: Math.round(cumulativeDeficit),
      days,
      // 7700 kcal ≈ 1 kg of body fat
      estimatedFatLoss: Math.round((cumulativeDeficit / 7700) * 100) / 100,
    })
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to compute cumulative deficit' }, { status: 500 })
  }
}
