// ── Health assessment utilities ───────────────────────────────────

export interface DayActivity {
  date: string
  deficit: number | null   // intake - burn (negative = caloric deficit = good)
  intake: number
  weight: number | null
}

export interface HealthInsights {
  score: number                  // 0–100
  positives: string[]            // things going well
  improvements: string[]         // areas to work on
  tip: string                    // single AI-style tip
}

// ── BMI ──────────────────────────────────────────────────────────

export function calcBMI(weight: number, heightCm: number): number {
  const h = heightCm / 100
  return Math.round((weight / (h * h)) * 10) / 10
}

export type BMICategory = 'Underweight' | 'Normal' | 'Overweight' | 'Obese'

export function getBMICategory(bmi: number): BMICategory {
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25)   return 'Normal'
  if (bmi < 30)   return 'Overweight'
  return 'Obese'
}

export const BMI_COLORS: Record<BMICategory, string> = {
  Underweight: '#9DB3C8',
  Normal:      '#a8b5a2',
  Overweight:  '#D4B896',
  Obese:       '#c4847a',
}

export const BMI_TEXT_COLORS: Record<BMICategory, string> = {
  Underweight: 'text-[#6a8da8]',
  Normal:      'text-secondary',
  Overweight:  'text-[#b8865e]',
  Obese:       'text-danger',
}

// ── Health score & insights ───────────────────────────────────────

export function generateHealthInsights(history: DayActivity[]): HealthInsights {
  const tracked = history.filter(d => d.deficit !== null)
  const n = tracked.length

  // 1. Deficit consistency: % days in actual deficit (deficit < 0)
  const deficitDays = tracked.filter(d => d.deficit! < 0).length
  const consistencyRatio = n > 0 ? deficitDays / n : 0
  const consistencyScore = Math.round(consistencyRatio * 40)

  // 2. Average deficit quality: ideal range −200 to −700 kcal/day
  const avgDeficit = n > 0
    ? tracked.reduce((s, d) => s + d.deficit!, 0) / n
    : 0
  let deficitQualityScore = 0
  if (avgDeficit < 0) {
    const abs = Math.abs(avgDeficit)
    if (abs >= 200 && abs <= 700) deficitQualityScore = 30
    else if (abs < 200)          deficitQualityScore = Math.round((abs / 200) * 20)
    else if (abs <= 1000)        deficitQualityScore = Math.round(30 - ((abs - 700) / 300) * 15)
    else                         deficitQualityScore = 10
  }

  // 3. Tracking completeness (out of 7 days)
  const completenessScore = Math.round(Math.min(n / 7, 1) * 20)

  // 4. Intake regularity (low variance = consistent eating)
  const intakes = tracked.map(d => d.intake)
  let regularityScore = 10
  if (intakes.length >= 3) {
    const avg = intakes.reduce((a, b) => a + b, 0) / intakes.length
    const variance = intakes.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / intakes.length
    const cv = Math.sqrt(variance) / avg  // coefficient of variation
    regularityScore = cv < 0.1 ? 10 : cv < 0.2 ? 7 : cv < 0.35 ? 4 : 2
  }

  const score = Math.min(100, consistencyScore + deficitQualityScore + completenessScore + regularityScore)

  // ── Positives ─────────────────────────────────────────────────
  const positives: string[] = []

  if (consistencyRatio >= 0.7)
    positives.push(`Deficit achieved on ${deficitDays} of ${n} tracked days`)
  else if (consistencyRatio >= 0.5)
    positives.push('More than half your days were on track')

  if (avgDeficit < -200 && avgDeficit > -700)
    positives.push('Your daily deficit is in the healthy range')

  if (completenessScore >= 16)
    positives.push('Great tracking consistency this week')

  if (positives.length === 0)
    positives.push('You\'re building a tracking habit — keep going')

  // ── Improvements ─────────────────────────────────────────────
  const improvements: string[] = []

  if (consistencyRatio < 0.5 && n >= 3)
    improvements.push('Aim for a deficit on more days this week')

  if (avgDeficit > -100 && n > 0)
    improvements.push('Your average intake is close to your burn — consider reducing slightly')

  if (avgDeficit < -900)
    improvements.push('Your deficit may be too aggressive — consider a more gradual pace')

  if (n < 4)
    improvements.push('Log meals more consistently for better insights')

  // ── AI tip ───────────────────────────────────────────────────
  const tips = [
    avgDeficit > -200
      ? 'Try reducing one high-calorie snack to create a meaningful daily deficit.'
      : avgDeficit < -800
      ? 'Consider adding a small balanced snack to keep your metabolism steady.'
      : 'Maintain your current pace — consistency over time delivers lasting results.',
    consistencyRatio < 0.5
      ? 'Planning meals ahead even one day at a time significantly improves consistency.'
      : 'You\'re on a strong streak — protect it by prepping one healthy meal in advance.',
  ]
  const tip = tips[Math.floor(Math.random() * tips.length)]

  return { score, positives, improvements, tip }
}
