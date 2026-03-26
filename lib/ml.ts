// ── ML utilities for weight prediction ───────────────────────────

export interface DayRecord {
  intake: number   // kcal
  weight: number   // kg
}

/**
 * 7-day (or custom window) moving average over a nullable array.
 */
export function movingAverage(
  values: (number | null)[],
  window: number = 7,
): (number | null)[] {
  return values.map((_, i) => {
    const slice = values
      .slice(Math.max(0, i - window + 1), i + 1)
      .filter((v): v is number => v !== null)
    if (slice.length === 0) return null
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 100) / 100
  })
}

/**
 * Estimate dynamic TDEE using 7-day average windows to smooth out
 * day-to-day water retention noise.
 *
 * Groups history into 7-day chunks, computes avg weight and avg intake
 * per chunk, then estimates TDEE from the weight change between chunks:
 *   TDEE ≈ avg_intake − (avg_weight_older − avg_weight_newer) / 7 × 7700
 *
 * History should be ordered most-recent-first (matching getPastDates output).
 * Requires at least 2 windows with ≥ 3 valid days each.
 */
export function calculateDynamicTDEE(history: DayRecord[]): number | null {
  const WINDOW = 7

  // Build 7-day windows (most-recent-first order preserved)
  const windows: Array<{ avgWeight: number; avgIntake: number }> = []
  for (let i = 0; i + WINDOW <= history.length; i += WINDOW) {
    const chunk = history.slice(i, i + WINDOW).filter(d => d.intake > 0 && d.weight > 0)
    if (chunk.length < 3) continue
    const avgWeight = chunk.reduce((s, d) => s + d.weight, 0) / chunk.length
    const avgIntake = chunk.reduce((s, d) => s + d.intake, 0) / chunk.length
    windows.push({ avgWeight, avgIntake })
  }

  if (windows.length < 2) return null

  // windows[0] = most recent, windows[1] = older
  // deltaWeight = older_avg − newer_avg (positive = losing weight)
  const samples: number[] = []
  for (let i = 1; i < windows.length; i++) {
    const deltaWeight = windows[i].avgWeight - windows[i - 1].avgWeight
    const estimated = windows[i - 1].avgIntake - (deltaWeight / 7) * 7700
    // sanity-gate: real TDEE is unlikely outside 800–5000 kcal
    if (estimated > 800 && estimated < 5000) samples.push(estimated)
  }

  if (samples.length < 1) return null
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
}

/**
 * Project future weight assuming a constant daily deficit.
 * Returns an array of predicted weights for days 1…days from lastWeight.
 */
export function predictFutureWeight(
  lastWeight: number,
  avgDailyDeficit: number,
  days: number,
): number[] {
  return Array.from({ length: days }, (_, i) => {
    const loss = (avgDailyDeficit * (i + 1)) / 7700
    return Math.round((lastWeight - loss) * 100) / 100
  })
}

/**
 * How many days to reach goalWeight at avgDailyDeficit pace.
 * Returns null if deficit ≤ 0 or already at/below goal.
 */
export function daysUntilGoal(
  currentWeight: number,
  goalWeight: number,
  avgDailyDeficit: number,
): number | null {
  if (avgDailyDeficit <= 0) return null
  const diff = currentWeight - goalWeight
  if (diff <= 0) return 0
  return Math.round((diff * 7700) / avgDailyDeficit)
}
