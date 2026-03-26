'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { formatDateShort } from '@/lib/utils'
import type { DailySummary } from '@/lib/summary'
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import {
  movingAverage,
  calculateDynamicTDEE,
  daysUntilGoal,
} from '@/lib/ml'

type Range = 7 | 14 | 30

// ── date helpers ──────────────────────────────────────────────────

function getPastDates(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}


function fmtGoalDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

// ── insight helpers ───────────────────────────────────────────────

interface CumulativeData {
  cumulativeDeficit: number | null
  days: number
  estimatedFatLoss: number
}

function getSummaryStatus(deficitValues: number[]) {
  if (deficitValues.length === 0)
    return { headline: 'No data yet', subtext: 'Start tracking to see your progress here.' }
  const negCount = deficitValues.filter(d => d < 0).length
  const ratio = negCount / deficitValues.length
  const tracked = deficitValues.length
  if (ratio >= 0.75)
    return { headline: "You're on track ✨", subtext: `Deficit on ${negCount} of ${tracked} tracked days` }
  if (ratio >= 0.5)
    return { headline: 'A steady rhythm this period', subtext: `More deficit days than not — heading the right way` }
  if (ratio >= 0.25)
    return { headline: 'Small progress still counts 💛', subtext: `A few higher-intake days, but overall doing okay` }
  return { headline: "A little wobble, and that's okay", subtext: `A tiny reset, and you're good to go` }
}

function getWeightNetChange(weightValues: number[]): string | null {
  if (weightValues.length < 2) return null
  const change = weightValues[weightValues.length - 1] - weightValues[0]
  if (Math.abs(change) < 0.05) return '→ stable'
  return `${change < 0 ? '↓' : '↑'} ${Math.abs(change).toFixed(1)} kg`
}

// ── pattern analysis ──────────────────────────────────────────────

interface HistoryRecord {
  date: string
  weight: number | null
  totalIntake: number
  exerciseKcal: number
  deficit: number | null
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface PatternInsight {
  icon: string
  text: string
  type: 'positive' | 'neutral' | 'warning'
}

function analyzePatterns(results: HistoryRecord[]): PatternInsight[] {
  const insights: PatternInsight[] = []
  // results is oldest-first from /api/history; reverse so most-recent-first for streak
  const reversed = [...results].reverse()
  const withDeficit = results.filter(s => s.deficit != null && s.totalIntake > 0)
  if (withDeficit.length < 7) return insights

  // 1. Weekend vs weekday
  const weekend = withDeficit.filter(s => { const d = new Date(s.date + 'T00:00:00').getDay(); return d === 0 || d === 6 })
  const weekday = withDeficit.filter(s => { const d = new Date(s.date + 'T00:00:00').getDay(); return d >= 1 && d <= 5 })

  if (weekend.length >= 2 && weekday.length >= 4) {
    const avgWE = weekend.reduce((s, d) => s + d.deficit!, 0) / weekend.length
    const avgWD = weekday.reduce((s, d) => s + d.deficit!, 0) / weekday.length
    const diff = Math.round(avgWE - avgWD)
    if (diff > 300)
      insights.push({ icon: '📅', text: `Weekend intake runs ~${diff} kcal higher than weekdays — a common pattern worth watching.`, type: 'warning' })
    else if (diff > 150)
      insights.push({ icon: '📅', text: `Weekends trend slightly higher (+${diff} kcal vs weekdays) but nothing dramatic.`, type: 'neutral' })
    else if (diff < -100)
      insights.push({ icon: '📅', text: `Your weekends are actually more on-track than weekdays — nice consistency.`, type: 'positive' })
    else
      insights.push({ icon: '📅', text: `No significant weekend effect — your intake stays consistent across the week.`, type: 'positive' })
  }

  // 2. Best and worst day of week
  const byDow: Record<number, number[]> = {}
  for (const s of withDeficit) {
    const dow = new Date(s.date + 'T00:00:00').getDay()
    if (!byDow[dow]) byDow[dow] = []
    byDow[dow].push(s.deficit!)
  }
  let bestDow = -1, bestAvg = Infinity, worstDow = -1, worstAvg = -Infinity
  for (const [dow, vals] of Object.entries(byDow)) {
    if (vals.length < 2) continue
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    if (avg < bestAvg) { bestAvg = avg; bestDow = Number(dow) }
    if (avg > worstAvg) { worstAvg = avg; worstDow = Number(dow) }
  }
  if (bestDow >= 0 && worstDow >= 0 && bestDow !== worstDow) {
    const bestStr = `${Math.round(bestAvg) > 0 ? '+' : ''}${Math.round(bestAvg)}`
    const worstStr = `${Math.round(worstAvg) > 0 ? '+' : ''}${Math.round(worstAvg)}`
    insights.push({
      icon: '📊',
      text: `${DAY_NAMES[bestDow]}s are your strongest days (avg ${bestStr} kcal). ${DAY_NAMES[worstDow]}s tend to be toughest (avg ${worstStr} kcal).`,
      type: bestAvg < 0 ? 'positive' : 'neutral',
    })
  }

  // 3. Deficit–weight correlation (oldest-first: deficit on day[i] → weight on day[i+1])
  const withBoth = results.filter(s => s.deficit != null && s.weight != null && s.totalIntake > 0)
  if (withBoth.length >= 5) {
    let correlated = 0, total = 0
    for (let i = 0; i < withBoth.length - 1; i++) {
      const curr = withBoth[i], next = withBoth[i + 1]
      if (curr.deficit! < -100) {
        total++
        if (next.weight! < curr.weight!) correlated++
      }
    }
    if (total >= 3) {
      const pct = Math.round((correlated / total) * 100)
      if (pct >= 65)
        insights.push({ icon: '📉', text: `${pct}% of deficit days are followed by a weight drop — your body responds well to deficits.`, type: 'positive' })
      else if (pct >= 40)
        insights.push({ icon: '📉', text: `Deficit days lead to a weight drop ${pct}% of the time. Short-term water fluctuation is normal.`, type: 'neutral' })
      else
        insights.push({ icon: '📉', text: `Weight doesn't always drop right after a deficit day — water retention can mask progress for days at a time.`, type: 'neutral' })
    }
  }

  // 4. Current deficit streak (reversed = most-recent-first)
  let i = 0, streak = 0
  while (i < reversed.length && reversed[i].deficit == null) i++
  while (i < reversed.length && reversed[i].deficit != null && reversed[i].deficit! < 0) { streak++; i++ }
  if (streak >= 3)
    insights.push({ icon: '🔥', text: `${streak}-day deficit streak — you're in a great rhythm right now.`, type: 'positive' })

  return insights
}

// ── custom tooltip ────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number | null; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const weight = payload.find(p => p.dataKey === 'weight')
  const deficit = payload.find(p => p.dataKey === 'deficit')

  return (
    <div className="bg-card border border-border rounded-2xl px-3.5 py-2.5 shadow-sm text-xs">
      <p className="text-muted font-medium mb-1.5">{label}</p>
      {weight?.value != null && (
        <p className="text-text mb-0.5">⚖️ {weight.value} kg</p>
      )}

      {deficit?.value != null && (
        <p className={Number(deficit.value) < 0 ? 'text-secondary' : 'text-danger'}>
          {Number(deficit.value) > 0 ? '+' : ''}{Number(deficit.value).toLocaleString()} kcal
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────

export default function SummaryView() {
  const [range, setRange] = useState<Range>(7)
  const [summaries, setSummaries] = useState<DailySummary[]>([])
  const [cumulative, setCumulative] = useState<CumulativeData | null>(null)
  const [loading, setLoading] = useState(false)

  // ML state
  const [dynamicTDEE, setDynamicTDEE] = useState<number | null>(null)
  const [estBMR, setEstBMR] = useState<number | null>(null)
  const [avgDeficit, setAvgDeficit] = useState<number | null>(null)
  const [lastKnownWeight, setLastKnownWeight] = useState<number | null>(null)
  const [goalWeight, setGoalWeight] = useState<number | null>(null)
  const [mlData, setMlData] = useState<HistoryRecord[]>([])

  // interaction
  const [pinnedDate, setPinnedDate] = useState<string | null>(null)

  // Fetch profile once for goal weight
  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(p => { if (p?.goalWeight) setGoalWeight(Number(p.goalWeight)) })
      .catch(() => {})
  }, [])

  // Fetch all history once on mount for ML + pattern analysis
  useEffect(() => {
    const fetchML = async () => {
      try {
        // /api/history returns all dates oldest-first
        const allRecords: HistoryRecord[] = await fetch('/api/history').then(r => r.json())
        setMlData(allRecords)

        // Use last 60 days for TDEE (more stable window)
        const cutoff = getPastDates(60).at(-1)!
        const recent = allRecords.filter(r => r.date >= cutoff)

        const history = recent
          .filter(s => s.totalIntake > 0 && s.weight)
          .map(s => ({ intake: s.totalIntake, weight: s.weight as number }))
          .reverse() // calculateDynamicTDEE expects most-recent-first

        const tdee = calculateDynamicTDEE(history)
        setDynamicTDEE(tdee)

        const exerciseDays = recent.filter(s => s.exerciseKcal > 0)
        const avgExercise = exerciseDays.length > 0
          ? Math.round(exerciseDays.reduce((s, d) => s + d.exerciseKcal, 0) / exerciseDays.length)
          : 0
        if (tdee !== null) setEstBMR(Math.round(tdee - avgExercise))

        const validDeficits = recent.filter(s => s.deficit != null).map(s => s.deficit as number)
        if (validDeficits.length > 0) {
          setAvgDeficit(Math.round(validDeficits.reduce((a, b) => a + b, 0) / validDeficits.length))
        }

        const latestWithWeight = [...allRecords].reverse().find(s => s.weight != null)
        if (latestWithWeight?.weight) setLastKnownWeight(latestWithWeight.weight)
      } catch { /* silent */ }
    }
    fetchML()
  }, [])

  // Fetch display data when range changes
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      setPinnedDate(null)
      const dates = getPastDates(range)
      const today = dates[0]
      const from = dates[dates.length - 1]
      try {
        const [results, cData] = await Promise.all([
          Promise.all(dates.map(d => fetch(`/api/summary/${d}`).then(r => r.json()))),
          fetch(`/api/cumulative-deficit?date=${today}&from=${from}`).then(r => r.json()),
        ])
        setSummaries(results)
        setCumulative(cData)
      } catch {
        setSummaries([])
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [range])

  // ── chart data ──────────────────────────────────────────────────

  const historicalData = [...summaries].reverse().map(s => ({
    date: formatDateShort(s.date),
    deficit: s.deficit ?? null,
    weight: s.weight ?? null,
  }))

  const weightSeries = historicalData.map(d => d.weight)
  const maSeries = movingAverage(weightSeries, 7)

  const combinedData = historicalData.map((d, i) => ({
    ...d,
    weightMA: maSeries[i],
  }))

  // min/max weight indices for in-chart labels
  let minWeightIdx = -1
  let maxWeightIdx = -1
  for (let i = 0; i < combinedData.length; i++) {
    const w = combinedData[i].weight
    if (w == null) continue
    if (minWeightIdx === -1 || w < combinedData[minWeightIdx].weight!) minWeightIdx = i
    if (maxWeightIdx === -1 || w > combinedData[maxWeightIdx].weight!) maxWeightIdx = i
  }

  const deficitValues = historicalData.filter(d => d.deficit !== null).map(d => d.deficit as number)
  const weightValues = historicalData.filter(d => d.weight !== null).map(d => d.weight as number)

  const hasData = deficitValues.length > 1 || weightValues.length > 1
  const weightNetChange = getWeightNetChange(weightValues)
  const status = getSummaryStatus(deficitValues)

  const totalPoints = combinedData.length
  const xAxisInterval = totalPoints <= 9 ? 0 : totalPoints <= 18 ? 1 : Math.floor(totalPoints / 9)
  const showDots = range <= 7

  // ── AI insight ─────────────────────────────────────────────────

  const aiInsight = useCallback((): { text: string; sub: string } | null => {
    if (!avgDeficit || avgDeficit >= 0) return null
    const absDeficit = Math.abs(avgDeficit)

    const metabolicLine = dynamicTDEE
      ? `Est. TDEE: ${dynamicTDEE.toLocaleString()} kcal/day${estBMR ? ` · Est. BMR: ${estBMR.toLocaleString()} kcal/day` : ''}`
      : null

    if (goalWeight !== null && lastKnownWeight !== null && lastKnownWeight > goalWeight) {
      const days = daysUntilGoal(lastKnownWeight, goalWeight, absDeficit)
      if (days !== null) {
        return {
          text: `At this pace, you'll reach ${goalWeight} kg by ${fmtGoalDate(days)}.`,
          sub: metabolicLine ?? `Based on an average daily deficit of ${absDeficit} kcal`,
        }
      }
    }

    if (dynamicTDEE) {
      return {
        text: `Your estimated metabolic rate is ${dynamicTDEE.toLocaleString()} kcal/day.`,
        sub: metabolicLine ?? `Avg deficit: ${absDeficit} kcal/day`,
      }
    }

    return null
  }, [avgDeficit, goalWeight, lastKnownWeight, dynamicTDEE, estBMR, range])

  const insight = aiInsight()

  const patternInsights = useMemo(() => analyzePatterns(mlData), [mlData])

  // ── render ─────────────────────────────────────────────────────

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-24">

      {/* Segmented control */}
      <div className="flex bg-bg rounded-2xl p-1 mb-4 border border-border">
        {([7, 14, 30] as Range[]).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all min-h-[40px] ${
              range === r ? 'bg-card text-text shadow-sm border border-border' : 'text-muted'
            }`}>
            {r === 7 ? '7 days' : r === 14 ? '14 days' : '30 days'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-muted py-16">Loading…</div>
      ) : (
        <>
          {/* ── Merged summary card ── */}
          <div className="bg-card rounded-2xl border border-border shadow-sm px-5 pt-4 pb-3 mb-4">
            <p className="text-sm font-medium text-muted mb-2">{status.headline}</p>
            {cumulative && cumulative.cumulativeDeficit !== null ? (
              <>
                <p className={`text-4xl font-bold tracking-tight leading-none mb-2 text-center ${
                  cumulative.cumulativeDeficit <= 0 ? 'text-secondary' : 'text-danger'
                }`}>
                  {cumulative.cumulativeDeficit !== 0
                    ? `${cumulative.cumulativeDeficit > 0 ? '+' : ''}${cumulative.cumulativeDeficit.toLocaleString()} kcal`
                    : '0 kcal'}
                </p>
                <p className="text-sm text-muted mb-1">
                  ≈ {Math.abs(cumulative.estimatedFatLoss)} kg estimated fat {cumulative.cumulativeDeficit <= 0 ? 'loss' : 'gain'}
                </p>
                <p className="text-xs text-muted/60">
                  {status.subtext} · tracked {cumulative.days} of {range} day{range > 1 ? 's' : ''}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">{status.subtext}</p>
            )}
          </div>

          {/* ── Dual-axis chart card ── */}
          {hasData && (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden mb-4">
              {/* Header */}
              <div className="px-5 pt-5 pb-2 flex items-center justify-between">
                <h2 className="font-semibold text-text">Deficit &amp; Weight</h2>
                <div className="flex items-center gap-3">
                  {weightNetChange && (
                    <span className="text-xs text-muted">{weightNetChange}</span>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="px-5 pb-3 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 rounded-full bg-[#a8b5a2]" />
                  <span className="text-[11px] text-muted">Weight</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 border-t border-dashed border-[#c4b0c4]" />
                  <span className="text-[11px] text-muted">7-day avg</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2.5 rounded-sm bg-[#a8b5a2]/35" />
                  <span className="text-[11px] text-muted">Deficit</span>
                </div>
              </div>

              {/* Chart */}
              <div className="pb-2">
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart
                    data={combinedData}
                    margin={{ left: 24, right: 24, top: 4, bottom: 0 }}
                    onClick={(e) => {
                      const label = e?.activeLabel as string | undefined
                      if (label) setPinnedDate(prev => prev === label ? null : label)
                    }}
                  >
                    {/* Deficit bars — background layer, right axis */}
                    <Bar
                      yAxisId="right"
                      dataKey="deficit"
                      radius={[2, 2, 0, 0]}
                      maxBarSize={16}
                      isAnimationActive={false}
                    >
                      {combinedData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.deficit === null ? 'transparent' : entry.deficit < 0 ? '#a8b5a2' : '#c4847a'}
                          fillOpacity={pinnedDate && entry.date !== pinnedDate ? 0.2 : 0.38}
                        />
                      ))}
                    </Bar>

                    {/* Pinned date reference line */}
                    {pinnedDate && (
                      <ReferenceLine
                        x={pinnedDate}
                        yAxisId="left"
                        stroke="#9b8ea0"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Zero reference for deficit */}
                    <ReferenceLine yAxisId="right" y={0} stroke="#e8e4df" strokeWidth={1} />

                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#9a9a9a' }}
                      tickLine={false}
                      axisLine={false}
                      interval={xAxisInterval}
                    />

                    {/* Left axis: weight (hidden labels, just domain) */}
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      hide
                      domain={['dataMin - 0.5', 'dataMax + 0.5']}
                    />

                    {/* Right axis: deficit (hidden) */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      hide
                    />

                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ stroke: '#e8e4df', strokeWidth: 1 }}
                    />

                    {/* Actual weight line */}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="weight"
                      stroke="#a8b5a2"
                      strokeWidth={2.5}
                      dot={showDots ? { fill: '#a8b5a2', r: 3, strokeWidth: 0 } : false}
                      activeDot={{ r: 5, fill: '#a8b5a2' }}
                      connectNulls={false}
                      isAnimationActive={false}
                      label={(props: any) => {
                        const isMin = props.index === minWeightIdx
                        const isMax = props.index === maxWeightIdx
                        if ((!isMin && !isMax) || props.value == null) return <g />
                        const isLeft = props.index < combinedData.length * 0.8
                        const anchor = isLeft ? 'start' : 'end'
                        const xOff = isLeft ? 6 : -6
                        const yOff = isMax ? -8 : 10
                        return (
                          <text
                            x={props.x + xOff} y={props.y + yOff}
                            fill="#a8b5a2" fontSize={10} textAnchor={anchor} fontWeight={600}
                          >
                            {props.value}
                          </text>
                        )
                      }}
                    />

                    {/* 7-day moving average */}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="weightMA"
                      stroke="#c4b0c4"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={false}
                      activeDot={false}
                      connectNulls={true}
                      isAnimationActive={false}
                    />

                    {/* Predicted weight — dashed, forward only */}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Pinned day detail */}
              {pinnedDate && (() => {
                const pt = combinedData.find(d => d.date === pinnedDate)
                if (!pt) return null
                return (
                  <div className="mx-5 mb-4 bg-bg rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-muted font-medium">{pinnedDate}</span>
                    <div className="flex items-center gap-4">
                      {pt.weight != null && (
                        <span className="text-xs text-text">⚖️ {pt.weight} kg</span>
                      )}

                      {pt.deficit != null && (
                        <span className={`text-xs ${pt.deficit < 0 ? 'text-secondary' : 'text-danger'}`}>
                          {pt.deficit > 0 ? '+' : ''}{pt.deficit.toLocaleString()} kcal
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Pattern Insights card ── */}
          {patternInsights.length > 0 && (
            <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4 mb-4">
              <p className="text-[11px] font-medium text-muted uppercase tracking-wide mb-3">Pattern Insights</p>
              <div className="space-y-3">
                {patternInsights.map((p, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-base leading-none mt-0.5 flex-shrink-0">{p.icon}</span>
                    <p className={`text-xs leading-relaxed ${
                      p.type === 'positive' ? 'text-text' : p.type === 'warning' ? 'text-[#b8865e]' : 'text-muted'
                    }`}>{p.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AI Insight card ── */}
          {insight && (
            <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4">
              <p className="text-[11px] font-medium text-muted uppercase tracking-wide mb-2">Metabolic Insight</p>
              <p className="text-sm font-medium text-text mb-1 leading-snug">{insight.text}</p>
              <p className="text-xs text-muted/70 leading-relaxed">{insight.sub}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
