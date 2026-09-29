import { calcBMR } from './bmr'

export interface DailySummary {
  date: string
  weight: number | null
  weightEstimated: boolean
  bmr: number | null
  restingKcal: number | null
  exerciseKcal: number | null
  avgRestingKcal7d: number | null
  avgExerciseKcal7d: number | null
  totalBurn: number | null
  totalIntake: number
  deficit: number | null
  profileComplete: boolean
}

function calcAge(birthday: string): number {
  const today = new Date()
  const dob = new Date(birthday)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

export function calcDailySummary(params: {
  date: string
  profile: { gender: string; birthday?: string | null; height: number } | null
  weight: number | null
  weightEstimated: boolean
  exerciseKcal: number | null
  restingKcal: number | null
  avgExerciseKcal7d?: number | null
  avgRestingKcal7d?: number | null
  totalIntake: number
}): DailySummary {
  const {
    date, profile, weight, weightEstimated, exerciseKcal, restingKcal,
    avgExerciseKcal7d = null, avgRestingKcal7d = null, totalIntake,
  } = params
  const age = profile?.birthday ? calcAge(profile.birthday) : null
  const profileComplete = !!(profile?.gender && age && profile?.height)

  let bmr: number | null = null
  let totalBurn: number | null = null
  let deficit: number | null = null

  if (profileComplete && weight !== null && profile && age) {
    bmr = Math.round(calcBMR(profile.gender, age, profile.height, weight))
  }

  // Logged resting energy (e.g. from Apple Health) is more accurate than the
  // formula estimate, so it takes over the burn calc for the day once present.
  // Unlogged exercise counts as 0 burn, same as before this field became nullable.
  const restingForBurn = restingKcal ?? bmr
  if (restingForBurn !== null) {
    totalBurn = restingForBurn + (exerciseKcal ?? 0)
    deficit = totalIntake - totalBurn
  }

  return {
    date,
    weight,
    weightEstimated,
    bmr,
    restingKcal,
    exerciseKcal,
    avgExerciseKcal7d,
    avgRestingKcal7d,
    totalBurn,
    totalIntake: Math.round(totalIntake),
    deficit: deficit !== null ? Math.round(deficit) : null,
    profileComplete,
  }
}
