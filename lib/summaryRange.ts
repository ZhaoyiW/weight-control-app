import { prisma } from './prisma'
import { calcDailySummary, type DailySummary } from './summary'

// Max days per request (Summary's custom range is capped at 365)
export const MAX_RANGE_DAYS = 400

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length)
}

// Same results as calling /api/summary/[date] for every day from `to` back to
// `from` (most-recent-first), but with a handful of queries instead of five
// per day.
export async function getSummariesInRange(from: string, to: string): Promise<DailySummary[]> {
  const dates: string[] = []
  for (let d = to; d >= from && dates.length < MAX_RANGE_DAYS; d = shiftDate(d, -1)) dates.push(d)
  if (dates.length === 0) return []

  const oldest = dates[dates.length - 1]
  const [profile, weightLogs, priorWeight, mealSums, activities] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: 1 } }),
    prisma.weightLog.findMany({ where: { date: { gte: oldest, lte: to } } }),
    prisma.weightLog.findFirst({ where: { date: { lt: oldest } }, orderBy: { date: 'desc' } }),
    prisma.mealEntry.groupBy({ by: ['date'], where: { date: { gte: oldest, lte: to } }, _sum: { kcal: true } }),
    // 7 extra days before the range for the trailing activity averages
    prisma.dailyActivity.findMany({ where: { date: { gte: shiftDate(oldest, -7), lte: to } } }),
  ])

  const weightByDate = new Map(weightLogs.map(w => [w.date, w.weight]))
  const intakeByDate = new Map(mealSums.map(m => [m.date, m._sum.kcal ?? 0]))
  const activityByDate = new Map(activities.map(a => [a.date, a]))

  // Walk oldest → newest so a day without a weigh-in carries the most recent
  // earlier weight forward (flagged as estimated), as the per-day route does.
  let lastWeight = priorWeight?.weight ?? null
  const summaries: DailySummary[] = []
  for (const date of [...dates].reverse()) {
    const logged = weightByDate.get(date)
    if (logged !== undefined) lastWeight = logged

    const trailing = activities.filter(a => a.date >= shiftDate(date, -7) && a.date <= shiftDate(date, -1))
    const activity = activityByDate.get(date)

    summaries.push(calcDailySummary({
      date,
      profile,
      weight: logged ?? lastWeight,
      weightEstimated: logged === undefined && lastWeight !== null,
      exerciseKcal: activity?.exerciseKcal ?? null,
      restingKcal: activity?.restingKcal ?? null,
      avgExerciseKcal7d: average(trailing.map(a => a.exerciseKcal).filter((v): v is number => v !== null)),
      avgRestingKcal7d: average(trailing.map(a => a.restingKcal).filter((v): v is number => v !== null)),
      totalIntake: intakeByDate.get(date) ?? 0,
    }))
  }
  return summaries.reverse()
}
