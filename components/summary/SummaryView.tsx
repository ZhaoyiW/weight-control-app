'use client'

import { useState, useEffect } from 'react'
import { formatDateShort } from '@/lib/utils'
import type { DailySummary } from '@/lib/summary'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

type Range = 7 | 14 | 30

function getPastDates(n: number): string[] {
  const dates: string[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    )
  }
  return dates
}

interface CumulativeData {
  cumulativeDeficit: number | null
  days: number
  estimatedFatLoss: number
}

// ── insight helpers ───────────────────────────────────────────────

function getSummaryStatus(deficitValues: number[], range: number) {
  if (deficitValues.length === 0)
    return { headline: 'No data yet', subtext: 'Start tracking to see your progress here.' }

  const posCount = deficitValues.filter((d) => d > 0).length
  const ratio = posCount / deficitValues.length
  const tracked = deficitValues.length

  if (ratio >= 0.75)
    return {
      headline: "You're on track ✨",
      subtext: `You maintained a deficit on ${posCount} of your ${tracked} tracked days. Keep it up.`,
    }
  if (ratio >= 0.5)
    return {
      headline: 'A steady rhythm this period',
      subtext: `More deficit days than not — you're heading in the right direction.`,
    }
  if (ratio >= 0.25)
    return {
      headline: 'Small progress still counts 💛',
      subtext: `A few higher-intake days showed up, but overall you're doing okay.`,
    }
  return {
    headline: "A little wobble, and that's okay",
    subtext: `This period was trickier. A tiny reset, and you're good to go.`,
  }
}

function getDeficitInsight(deficitValues: number[]): string {
  if (deficitValues.length < 3) return ''
  const mid = Math.floor(deficitValues.length / 2)
  const avgFirst = deficitValues.slice(0, mid).reduce((a, b) => a + b, 0) / mid
  const avgSecond = deficitValues.slice(mid).reduce((a, b) => a + b, 0) / (deficitValues.length - mid)
  const avgAll = deficitValues.reduce((a, b) => a + b, 0) / deficitValues.length
  if (avgAll < 0) return 'Intake exceeded burn on most days this period.'
  if (Math.abs(avgSecond - avgFirst) < 120) return 'Your daily deficit stayed fairly consistent.'
  if (avgSecond > avgFirst) return 'Your deficit strengthened toward the end of the period.'
  return 'Your deficit was stronger earlier in the period.'
}

function getWeightTrendInsight(weightValues: number[]): string {
  if (weightValues.length < 2) return ''
  const first = weightValues[0]
  const last = weightValues[weightValues.length - 1]
  const change = last - first
  if (Math.abs(change) < 0.3) return 'Weight stayed fairly steady this period.'
  if (change <= -0.5) return 'Your weight trend is moving gently downward 🌿'
  if (change < 0) return 'A slight dip showed up — keep the momentum 💛'
  if (change >= 0.5) return 'A slight uptick appeared. Small adjustments can help.'
  return 'Weight shifted a little. Keep tracking for clearer trends.'
}

function getWeightNetChange(weightValues: number[]): string | null {
  if (weightValues.length < 2) return null
  const change = weightValues[weightValues.length - 1] - weightValues[0]
  if (Math.abs(change) < 0.05) return '→ stable'
  const sign = change < 0 ? '↓' : '↑'
  return `${sign} ${Math.abs(change).toFixed(1)} kg`
}

// ─────────────────────────────────────────────────────────────────

export default function SummaryView() {
  const [range, setRange] = useState<Range>(7)
  const [summaries, setSummaries] = useState<DailySummary[]>([])
  const [cumulative, setCumulative] = useState<CumulativeData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      const dates = getPastDates(range)
      const today = dates[0]
      const from = dates[dates.length - 1]
      try {
        const [results, cData] = await Promise.all([
          Promise.all(dates.map((d) => fetch(`/api/summary/${d}`).then((r) => r.json()))),
          fetch(`/api/cumulative-deficit?date=${today}&from=${from}`).then((r) => r.json()),
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

  const chartData = [...summaries].reverse().map((s) => ({
    date: formatDateShort(s.date),
    deficit: s.deficit ?? null,
    weight: s.weight ?? null,
  }))

  const deficitValues = chartData.filter((d) => d.deficit !== null).map((d) => d.deficit as number)
  const weightValues = chartData.filter((d) => d.weight !== null).map((d) => d.weight as number)

  const hasDeficitData = deficitValues.length > 1
  const hasWeightData = weightValues.length > 1

  const avgDeficit = deficitValues.length > 0
    ? Math.round(deficitValues.reduce((a, b) => a + b, 0) / deficitValues.length)
    : null

  const weightNetChange = getWeightNetChange(weightValues)

  const xAxisInterval = range <= 7 ? 0 : range <= 14 ? 1 : 4
  const showDots = range < 30

  const status = getSummaryStatus(deficitValues, range)
  const deficitInsight = getDeficitInsight(deficitValues)
  const weightInsight = getWeightTrendInsight(weightValues)

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-28">
      {/* Status card — top anchor */}
      <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4 mb-4">
        <p className="text-base font-semibold text-text mb-1">{status.headline}</p>
        <p className="text-sm text-muted leading-relaxed">{status.subtext}</p>
      </div>

      {/* Segmented control — pill style */}
      <div className="flex bg-bg rounded-2xl p-1 mb-5 border border-border">
        {([7, 14, 30] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all min-h-[40px] ${
              range === r
                ? 'bg-card text-text shadow-sm border border-border'
                : 'text-muted'
            }`}
          >
            {r === 7 ? '7 days' : r === 14 ? '14 days' : '30 days'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-muted py-16">Loading…</div>
      ) : (
        <>

          {/* Cumulative deficit — human hierarchy */}
          {cumulative && cumulative.cumulativeDeficit !== null && (
            <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4 mb-4">
              <p className={`text-2xl font-bold mb-0.5 ${cumulative.cumulativeDeficit >= 0 ? 'text-secondary' : 'text-danger'}`}>
                {cumulative.cumulativeDeficit !== 0
                  ? `${cumulative.cumulativeDeficit > 0 ? '−' : '+'}${Math.abs(cumulative.cumulativeDeficit).toLocaleString()} kcal`
                  : '0 kcal'}
              </p>
              <p className="text-sm text-muted mb-3">
                ≈ {cumulative.estimatedFatLoss > 0 ? '−' : '+'}{Math.abs(cumulative.estimatedFatLoss)} kg estimated fat {cumulative.cumulativeDeficit >= 0 ? 'loss' : 'gain'}
              </p>
              <p className="text-xs text-muted/70">
                Tracked on {cumulative.days} of the last {range} day{range > 1 ? 's' : ''}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {/* Daily Deficit Chart */}
            {hasDeficitData && (
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-text">Daily Deficit</h2>
                  {avgDeficit !== null && (
                    <span className="text-xs text-muted">avg {avgDeficit} kcal</span>
                  )}
                </div>
                <div className="pb-2">
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData} margin={{ left: 24, right: 24, top: 4, bottom: 0 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#9a9a9a' }}
                        tickLine={false}
                        axisLine={false}
                        interval={xAxisInterval}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ background: '#fff', border: '1px solid #e8e4df', borderRadius: '12px', fontSize: '12px' }}
                        formatter={(val) => [`${val} kcal`, 'Deficit']}
                      />
                      <ReferenceLine y={0} stroke="#e8e4df" strokeWidth={1.5} />
                      <Line
                        type="monotone"
                        dataKey="deficit"
                        stroke="#9b8ea0"
                        strokeWidth={2.5}
                        dot={showDots ? { fill: '#9b8ea0', r: 4 } : false}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {deficitInsight && (
                  <p className="px-5 pb-4 text-xs text-muted leading-relaxed">{deficitInsight}</p>
                )}
              </div>
            )}

            {/* Weight Trend Chart */}
            {hasWeightData && (
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-text">Weight Trend</h2>
                  {weightNetChange && (
                    <span className="text-xs text-muted">{weightNetChange}</span>
                  )}
                </div>
                <div className="pb-2">
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData} margin={{ left: 24, right: 24, top: 4, bottom: 0 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#9a9a9a' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e8e4df', strokeWidth: 1.5 }}
                        interval={xAxisInterval}
                      />
                      <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                      <Tooltip
                        contentStyle={{ background: '#fff', border: '1px solid #e8e4df', borderRadius: '12px', fontSize: '12px' }}
                        formatter={(val) => [`${val} kg`, 'Weight']}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#a8b5a2"
                        strokeWidth={2.5}
                        dot={showDots ? { fill: '#a8b5a2', r: 4 } : false}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {weightInsight && (
                  <p className="px-5 pb-4 text-xs text-muted leading-relaxed">{weightInsight}</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
