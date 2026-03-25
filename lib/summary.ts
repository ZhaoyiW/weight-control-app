import { calcBMR } from './bmr'

export interface DailySummary {
  date: string
  weight: number | null
  weightEstimated: boolean
  bmr: number | null
  exerciseKcal: number
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
  exerciseKcal: number
  totalIntake: number
}): DailySummary {
  const { date, profile, weight, weightEstimated, exerciseKcal, totalIntake } = params
  const age = profile?.birthday ? calcAge(profile.birthday) : null
  const profileComplete = !!(profile?.gender && age && profile?.height)

  let bmr: number | null = null
  let totalBurn: number | null = null
  let deficit: number | null = null

  if (profileComplete && weight !== null && profile && age) {
    bmr = Math.round(calcBMR(profile.gender, age, profile.height, weight))
    totalBurn = bmr + exerciseKcal
    deficit = totalBurn - totalIntake
  }

  return {
    date,
    weight,
    weightEstimated,
    bmr,
    exerciseKcal,
    totalBurn,
    totalIntake: Math.round(totalIntake),
    deficit: deficit !== null ? Math.round(deficit) : null,
    profileComplete,
  }
}
