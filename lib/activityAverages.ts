import { prisma } from './prisma'

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length)
}

// Average of the 7 calendar days immediately before `date`, over whichever
// of those days actually have a logged value (unlogged days are skipped,
// not treated as 0) — used as a suggested default before today is logged.
export async function getTrailing7DayAverages(date: string) {
  const from = shiftDate(date, -7)
  const to = shiftDate(date, -1)

  const rows = await prisma.dailyActivity.findMany({
    where: { date: { gte: from, lte: to } },
    select: { exerciseKcal: true, restingKcal: true },
  })

  const exerciseVals = rows.map(r => r.exerciseKcal).filter((v): v is number => v !== null)
  const restingVals = rows.map(r => r.restingKcal).filter((v): v is number => v !== null)

  return {
    avgExerciseKcal7d: average(exerciseVals),
    avgRestingKcal7d: average(restingVals),
  }
}
