import { prisma } from '@/lib/prisma'
import { calcBMR } from '@/lib/bmr'

function calcAge(birthday: string): number {
  const today = new Date()
  const dob = new Date(birthday)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

// Returns all dates that have either a weight log or meal entries,
// with date, weight, totalIntake, exerciseKcal, deficit (null if profile incomplete)
export async function GET() {
  try {
    const [profile, weightLogs, mealsByDate, activities] = await Promise.all([
      prisma.userProfile.findUnique({ where: { id: 1 } }),
      prisma.weightLog.findMany({ orderBy: { date: 'asc' } }),
      prisma.mealEntry.groupBy({ by: ['date'], _sum: { kcal: true }, orderBy: { date: 'asc' } }),
      prisma.dailyActivity.findMany({ orderBy: { date: 'asc' } }),
    ])

    // Only include dates that have meal entries (intake > 0)
    const dateSet = new Set<string>()
    for (const m of mealsByDate) dateSet.add(m.date)
    const dates = Array.from(dateSet).sort()

    const weightMap = new Map(weightLogs.map(w => [w.date, w.weight]))
    const intakeMap = new Map(mealsByDate.map(m => [m.date, m._sum.kcal ?? 0]))
    const exerciseMap = new Map(activities.map(a => [a.date, a.exerciseKcal]))

    const age = profile?.birthday ? calcAge(profile.birthday) : null
    const profileComplete = !!(profile?.gender && age && profile?.height)

    // For weight estimation: build sorted array of logged weights for forward-fill
    const sortedWeightDates = weightLogs.map(w => w.date)

    const records = dates.map(date => {
      const weight = weightMap.get(date) ?? null
      const totalIntake = intakeMap.get(date) ?? 0
      const exerciseKcal = exerciseMap.get(date) ?? 0

      // Use actual weight if logged, otherwise last known weight before this date
      let effectiveWeight = weight
      if (!effectiveWeight) {
        const prev = sortedWeightDates.filter(d => d < date).at(-1)
        if (prev) effectiveWeight = weightMap.get(prev) ?? null
      }

      let deficit: number | null = null
      if (profileComplete && effectiveWeight && profile && age) {
        const bmr = calcBMR(profile.gender, age, profile.height, effectiveWeight)
        deficit = Math.round(totalIntake - (bmr + exerciseKcal))
      }

      return { date, weight, totalIntake, exerciseKcal, deficit }
    })

    return Response.json(records)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
