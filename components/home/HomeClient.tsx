'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, TrendingDown, X, AlertCircle, ChevronLeft, ChevronRight, Utensils } from 'lucide-react'
import type { DailySummary } from '@/lib/summary'
import { formatDate, formatDayOfWeek, today } from '@/lib/utils'
import { TAB_VISIT_EVENT } from '@/components/BottomNav'
import DatePicker from '@/components/ui/DatePicker'

interface HomeClientProps {
  summary: DailySummary
}

function calcGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return '🌅 Good morning'
  if (hour < 18) return '☀️ Good afternoon'
  return '🌙 Good evening'
}

// Prefill with the logged value if present, else the 7-day average as a suggested default.
function defaultInputValue(logged: number | null, avg7d: number | null): string {
  if (logged !== null) return logged.toString()
  if (avg7d !== null) return avg7d.toString()
  return ''
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface SheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

function Sheet({ isOpen, onClose, title, children }: SheetProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-x-0 top-0 h-dvh z-[200] flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85dvh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-bg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} className="text-muted" />
          </button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}

export default function HomeClient({ summary: initialSummary }: HomeClientProps) {
  const router = useRouter()
  const [greeting, setGreeting] = useState('')
  const [summary, setSummary] = useState<DailySummary>(initialSummary)
  const [date, setDate] = useState(initialSummary.date)
  const [fetching, setFetching] = useState(false)

  useEffect(() => { setGreeting(calcGreeting()) }, [])

  // Always refetch on mount: the initial props can be a stale cached render
  // (Next.js's client-side router cache) from the last time this page was
  // visited, and this also corrects the server's UTC date to local "today".
  useEffect(() => {
    const localToday = today()
    setDate(localToday)
    fetchSummary(localToday)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [weightSheet, setWeightSheet] = useState(false)
  const [exerciseSheet, setExerciseSheet] = useState(false)
  const [restingSheet, setRestingSheet] = useState(false)
  const [weightValue, setWeightValue] = useState(initialSummary.weight?.toString() ?? '')
  const [exerciseValue, setExerciseValue] = useState(
    defaultInputValue(initialSummary.exerciseKcal, initialSummary.avgExerciseKcal7d)
  )
  const [restingValue, setRestingValue] = useState(
    defaultInputValue(initialSummary.restingKcal, initialSummary.avgRestingKcal7d)
  )
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')


  const isToday = date === today()
  const [showCalendar, setShowCalendar] = useState(false)

  const fetchSummary = useCallback(async (d: string) => {
    setFetching(true)
    setMessage('')
    try {
        const res = await fetch(`/api/summary/${d}`)
      const data: DailySummary = await res.json()
      setSummary(data)
      setWeightValue(data.weight?.toString() ?? '')
      setExerciseValue(defaultInputValue(data.exerciseKcal, data.avgExerciseKcal7d))
      setRestingValue(defaultInputValue(data.restingKcal, data.avgRestingKcal7d))
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    const onTabVisit = (e: Event) => {
      if ((e as CustomEvent).detail === '/') {
        const t = today()
        setDate(t)
        fetchSummary(t)
      }
    }
    const onVisible = () => {
      if (!document.hidden) {
        const t = today()
        setDate(t)
        fetchSummary(t)
      }
    }
    window.addEventListener(TAB_VISIT_EVENT, onTabVisit)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener(TAB_VISIT_EVENT, onTabVisit)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchSummary])

  const goToDate = useCallback((d: string) => {
    if (d > today()) return // no future dates
    setDate(d)
    fetchSummary(d)
  }, [fetchSummary])

  const handleWeightSubmit = useCallback(async () => {
    if (!weightValue || isNaN(Number(weightValue))) return
    setLoading(true)
    try {
      await fetch('/api/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, weight: Number(weightValue) }),
      })
      setMessage('Weight saved!')
      setWeightSheet(false)
      fetchSummary(date)
    } catch {
      setMessage('Failed to save weight')
    } finally {
      setLoading(false)
    }
  }, [weightValue, date, fetchSummary])

  const handleExerciseSubmit = useCallback(async () => {
    if (!exerciseValue || isNaN(Number(exerciseValue))) return
    setLoading(true)
    try {
      await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, exerciseKcal: Number(exerciseValue) }),
      })
      setMessage('Exercise logged!')
      setExerciseSheet(false)
      fetchSummary(date)
    } catch {
      setMessage('Failed to save exercise')
    } finally {
      setLoading(false)
    }
  }, [exerciseValue, date, fetchSummary])

  const handleRestingSubmit = useCallback(async () => {
    if (!restingValue || isNaN(Number(restingValue))) return
    setLoading(true)
    try {
      await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, restingKcal: Number(restingValue) }),
      })
      setMessage('Resting energy logged!')
      setRestingSheet(false)
      fetchSummary(date)
    } catch {
      setMessage('Failed to save resting energy')
    } finally {
      setLoading(false)
    }
  }, [restingValue, date, fetchSummary])

  const deficitColor =
    summary.deficit === null
      ? 'text-muted'
      : summary.deficit < 0
      ? 'text-secondary'
      : 'text-danger'

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-24">
      {/* Header with date nav */}
      <div className="mb-6">
        <p className="text-muted text-sm text-center">{greeting}</p>
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => goToDate(shiftDate(date, -1))}
            className="p-1.5 rounded-xl hover:bg-border transition-colors"
          >
            <ChevronLeft size={20} className="text-muted" />
          </button>
          <button
            className="flex-1 text-center"
            onClick={() => setShowCalendar(true)}
          >
            <span className={`text-2xl font-bold ${fetching ? 'opacity-50' : 'text-text'}`}>
              {isToday ? 'Today' : formatDate(date)}
              <span className="text-muted"> · {formatDayOfWeek(date)}</span>
            </span>
          </button>
          <button
            onClick={() => goToDate(shiftDate(date, 1))}
            disabled={isToday}
            className="p-1.5 rounded-xl hover:bg-border transition-colors disabled:opacity-30"
          >
            <ChevronRight size={20} className="text-muted" />
          </button>
        </div>
        {!isToday && (
          <button
            onClick={() => goToDate(today())}
            className="mt-1 mx-auto block text-xs text-primary font-medium"
          >
            Back to today
          </button>
        )}
      </div>

      {/* Profile incomplete warning */}
      {!summary.profileComplete && (
        <div className="flex items-start gap-3 bg-accent/15 border border-accent/30 rounded-2xl p-4 mb-5">
          <AlertCircle size={20} className="text-accent mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-text">Profile incomplete</p>
            <p className="text-xs text-muted mt-0.5">
              Add your gender, age, and height in Profile to see calorie burn estimates.
            </p>
          </div>
        </div>
      )}

      {/* Flash message */}
      {message && (
        <div className="bg-secondary/15 border border-secondary/30 rounded-xl p-3 mb-4 text-sm text-text text-center">
          {message}
        </div>
      )}

      {/* Ring chart */}
      {(() => {
        const statusMsg =
          summary.bmr !== null && summary.totalBurn !== null
            ? summary.totalIntake < summary.bmr
              ? "Hmm… still room for a bite 👀"
              : summary.totalIntake <= summary.totalBurn
              ? "Perfect balance achieved ⚖️"
              : "Oops… a tiny bit extra 😅"
            : null
        const R = 88
        const sw = 18
        const C = 2 * Math.PI * R
        const ratio = summary.totalBurn ? Math.min(summary.totalIntake / summary.totalBurn, 1) : 0
        const fill = C * ratio
        const intakeColor =
          summary.bmr !== null && summary.totalBurn !== null &&
          summary.totalIntake >= summary.bmr && summary.totalIntake <= summary.totalBurn
            ? 'text-secondary'
            : 'text-danger'
        return (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 mb-6">
            {statusMsg && (
              <p className="text-base text-muted text-center mb-5">{statusMsg}</p>
            )}
            <div className="flex flex-col items-center">
              <div className="relative">
                <svg width="220" height="220" viewBox="0 0 220 220">
                  <circle cx="110" cy="110" r={R} fill="none" stroke="#e8e4df" strokeWidth={sw} />
                  {summary.totalBurn && (
                    <circle
                      cx="110" cy="110" r={R}
                      fill="none"
                      stroke="#9b8ea0"
                      strokeWidth={sw}
                      strokeDasharray={`${fill} ${C - fill}`}
                      strokeLinecap="round"
                      transform="rotate(-90 110 110)"
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className={`text-5xl font-bold ${deficitColor}`}>
                    {summary.deficit !== null
                      ? `${summary.deficit > 0 ? '+' : ''}${summary.deficit}`
                      : '—'}
                  </p>
                  <p className="text-sm text-muted mt-1">kcal</p>
                  {summary.totalBurn && (
                    <p className="text-sm text-muted mt-1.5">
                      {summary.totalIntake} / {summary.totalBurn}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-4 w-full mt-4">
                <div className="flex-1 bg-bg rounded-xl p-4 text-center">
                  <p className="text-sm text-muted mb-1">🍽️ Intake</p>
                  <p className={`text-xl font-bold ${intakeColor}`}>{summary.totalIntake}</p>
                  <p className="text-xs text-muted">kcal</p>
                </div>
                <div className="flex-1 bg-bg rounded-xl p-4 text-center">
                  <p className="text-sm text-muted mb-1">🔥 Burn</p>
                  <p className="text-xl font-bold text-text">{summary.totalBurn ?? '—'}</p>
                  <p className="text-xs text-muted">kcal</p>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Weight / BMR / Exercise / Resting Energy grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-8">
        <button
          onClick={() => setWeightSheet(true)}
          className="bg-card rounded-2xl border border-border shadow-sm p-3 text-left active:scale-95 transition-transform"
        >
          <p className="text-xs text-muted mb-0.5">⚖️ Weight</p>
          <p className="text-base font-semibold text-text">
            {summary.weight ? `${summary.weight}` : '—'}
          </p>
          <p className="text-xs text-muted">
            {summary.weight ? 'kg' : ''}
            {summary.weightEstimated && ' est.'}
          </p>
        </button>
        <div className="bg-card rounded-2xl border border-border shadow-sm p-3">
          <p className="text-xs text-muted mb-0.5">🧍‍♀️ BMR (calculated)</p>
          <p className="text-base font-semibold text-text">
            {summary.bmr ?? '—'}
          </p>
          <p className="text-xs text-muted">{summary.bmr ? 'kcal' : ''}</p>
        </div>
        <button
          onClick={() => setExerciseSheet(true)}
          className="bg-card rounded-2xl border border-border shadow-sm p-3 text-left active:scale-95 transition-transform"
        >
          <p className="text-xs text-muted mb-0.5">🏃‍♀️ Exercise</p>
          <p className="text-base font-semibold text-text">
            {summary.exerciseKcal ?? '—'}
          </p>
          <p className="text-xs text-muted">
            {summary.exerciseKcal !== null ? 'kcal' : 'tap to log'}
          </p>
        </button>
        <button
          onClick={() => setRestingSheet(true)}
          className="bg-card rounded-2xl border border-border shadow-sm p-3 text-left active:scale-95 transition-transform"
        >
          <p className="text-xs text-muted mb-0.5">🧘‍♀️ Resting Energy</p>
          <p className="text-base font-semibold text-text">
            {summary.restingKcal ?? '—'}
          </p>
          <p className="text-xs text-muted">
            {summary.restingKcal ? 'kcal · logged' : 'tap to log'}
          </p>
        </button>
      </div>

      {/* Weight Sheet */}
      <Sheet isOpen={weightSheet} onClose={() => setWeightSheet(false)} title="Log Weight">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">Weight (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="e.g. 60.5"
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-primary/40 text-lg"
              autoFocus
            />
          </div>
          <button
            onClick={handleWeightSubmit}
            disabled={loading || !weightValue}
            className="w-full bg-primary text-white rounded-xl px-4 py-3 font-medium disabled:opacity-50 min-h-[48px]"
          >
            {loading ? 'Saving…' : 'Save Weight'}
          </button>
        </div>
      </Sheet>

      {/* Exercise Sheet */}
      <Sheet isOpen={exerciseSheet} onClose={() => setExerciseSheet(false)} title="Log Exercise">
        <div className="space-y-4">
          {summary.exerciseKcal === null && summary.avgExerciseKcal7d !== null && (
            <p className="text-xs text-muted -mt-2">
              Prefilled with your 7-day average ({summary.avgExerciseKcal7d} kcal) — adjust if today's different.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-text mb-2">Calories burned (kcal)</label>
            <input
              type="number"
              inputMode="decimal"
              step="1"
              placeholder="e.g. 300"
              value={exerciseValue}
              onChange={(e) => setExerciseValue(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-primary/40 text-lg"
              autoFocus
            />
          </div>
          <button
            onClick={handleExerciseSubmit}
            disabled={loading || !exerciseValue}
            className="w-full bg-primary text-white rounded-xl px-4 py-3 font-medium disabled:opacity-50 min-h-[48px]"
          >
            {loading ? 'Saving…' : 'Save Exercise'}
          </button>
        </div>
      </Sheet>

      {/* Resting Energy Sheet */}
      <Sheet isOpen={restingSheet} onClose={() => setRestingSheet(false)} title="Log Resting Energy">
        <div className="space-y-4">
          <p className="text-xs text-muted -mt-2">
            From your Apple Watch/iPhone Health app (Health → Resting Energy). Once logged, this replaces the calculated BMR in today&apos;s burn total.
          </p>
          {summary.restingKcal === null && summary.avgRestingKcal7d !== null && (
            <p className="text-xs text-muted -mt-2">
              Prefilled with your 7-day average ({summary.avgRestingKcal7d} kcal) — adjust if today's different.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-text mb-2">Resting energy (kcal)</label>
            <input
              type="number"
              inputMode="decimal"
              step="1"
              placeholder="e.g. 1450"
              value={restingValue}
              onChange={(e) => setRestingValue(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-primary/40 text-lg"
              autoFocus
            />
          </div>
          <button
            onClick={handleRestingSubmit}
            disabled={loading || !restingValue}
            className="w-full bg-primary text-white rounded-xl px-4 py-3 font-medium disabled:opacity-50 min-h-[48px]"
          >
            {loading ? 'Saving…' : 'Save Resting Energy'}
          </button>
        </div>
      </Sheet>
      {showCalendar && (
        <DatePicker
          value={date}
          max={today()}
          onChange={(d) => goToDate(d)}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  )
}
