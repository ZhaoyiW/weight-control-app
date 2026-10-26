'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, TrendingDown, X, AlertCircle, ChevronLeft, ChevronRight, Utensils } from 'lucide-react'
import type { DailySummary } from '@/lib/summary'
import { formatDate, formatDayOfWeek, today } from '@/lib/utils'
import { TAB_VISIT_EVENT } from '@/components/BottomNav'
import DatePicker from '@/components/ui/DatePicker'
import { useDuoLayout } from '@/components/DuoLayoutProvider'

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

interface DayPanelProps {
  summary: DailySummary
  isCompactHeight: boolean
  interactive: boolean
  onTapWeight?: () => void
  onTapExercise?: () => void
  onTapResting?: () => void
}

// Ring chart + Weight/BMR/Exercise/Resting Energy grid for one day. Used twice
// side-by-side (yesterday + today) on inner-landscape, both editable.
function DayPanel({ summary, isCompactHeight, interactive, onTapWeight, onTapExercise, onTapResting }: DayPanelProps) {
  const deficitColor =
    summary.deficit === null
      ? 'text-muted'
      : summary.deficit < 0
      ? 'text-secondary'
      : 'text-danger'

  const statusMsg =
    summary.bmr !== null && summary.totalBurn !== null
      ? summary.totalIntake < summary.bmr
        ? "Hmm… still room for a bite 👀"
        : summary.totalIntake <= summary.totalBurn
        ? "Perfect balance achieved ⚖️"
        : "Oops… a tiny bit extra 😅"
      : null
  const R = isCompactHeight ? 64 : 88
  const sw = isCompactHeight ? 14 : 18
  const svgSize = isCompactHeight ? 170 : 220
  const center = svgSize / 2
  const C = 2 * Math.PI * R
  const ratio = summary.totalBurn ? Math.min(summary.totalIntake / summary.totalBurn, 1) : 0
  const fill = C * ratio
  const intakeColor =
    summary.bmr !== null && summary.totalBurn !== null &&
    summary.totalIntake >= summary.bmr && summary.totalIntake <= summary.totalBurn
      ? 'text-secondary'
      : 'text-danger'

  const cardCls = `bg-card rounded-2xl border border-border shadow-sm ${isCompactHeight ? 'p-2' : 'p-3'}`
  const valueCls = `font-semibold text-text ${isCompactHeight ? 'text-sm' : 'text-base'}`

  return (
    <>
      {/* Ring chart */}
      <div className={`bg-card rounded-2xl border border-border shadow-sm ${isCompactHeight ? 'p-4 mb-3' : 'p-6 mb-6'}`}>
        {statusMsg && (
          <p className={`text-muted text-center ${isCompactHeight ? 'text-xs mb-2' : 'text-base mb-5'}`}>{statusMsg}</p>
        )}
        <div className="flex flex-col items-center">
          <div className="relative">
            <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
              <circle cx={center} cy={center} r={R} fill="none" stroke="#e8e4df" strokeWidth={sw} />
              {summary.totalBurn && (
                <circle
                  cx={center} cy={center} r={R}
                  fill="none"
                  stroke="#9b8ea0"
                  strokeWidth={sw}
                  strokeDasharray={`${fill} ${C - fill}`}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${center} ${center})`}
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className={`font-bold ${deficitColor} ${isCompactHeight ? 'text-3xl' : 'text-5xl'}`}>
                {summary.deficit !== null
                  ? `${summary.deficit > 0 ? '+' : ''}${summary.deficit}`
                  : '—'}
              </p>
              <p className={`text-muted ${isCompactHeight ? 'text-[10px] mt-0' : 'text-sm mt-1'}`}>kcal</p>
              {summary.totalBurn && (
                <p className={`text-muted ${isCompactHeight ? 'text-[10px] mt-0.5' : 'text-sm mt-1.5'}`}>
                  {summary.totalIntake} / {summary.totalBurn}
                </p>
              )}
            </div>
          </div>
          <div className={`flex gap-4 w-full ${isCompactHeight ? 'mt-3' : 'mt-4'}`}>
            <div className={`flex-1 bg-bg rounded-xl text-center ${isCompactHeight ? 'p-2.5' : 'p-4'}`}>
              <p className={`text-muted mb-1 ${isCompactHeight ? 'text-xs' : 'text-sm'}`}>🍽️ Intake</p>
              <p className={`font-bold ${intakeColor} ${isCompactHeight ? 'text-lg' : 'text-xl'}`}>{summary.totalIntake}</p>
              <p className="text-xs text-muted">kcal</p>
            </div>
            <div className={`flex-1 bg-bg rounded-xl text-center ${isCompactHeight ? 'p-2.5' : 'p-4'}`}>
              <p className={`text-muted mb-1 ${isCompactHeight ? 'text-xs' : 'text-sm'}`}>🔥 Burn</p>
              <p className={`font-bold text-text ${isCompactHeight ? 'text-lg' : 'text-xl'}`}>{summary.totalBurn ?? '—'}</p>
              <p className="text-xs text-muted">kcal</p>
            </div>
          </div>
        </div>
      </div>

      {/* Weight / BMR / Exercise / Resting Energy grid */}
      <div className={`grid grid-cols-2 ${isCompactHeight ? 'gap-1.5 mb-3' : 'gap-2.5 mb-8'}`}>
        {interactive ? (
          <button onClick={onTapWeight} className={`${cardCls} text-left active:scale-95 transition-transform`}>
            <p className="text-xs text-muted mb-0.5">⚖️ Weight</p>
            <p className={valueCls}>{summary.weight ? `${summary.weight}` : '—'}</p>
            <p className="text-xs text-muted">
              {summary.weight ? 'kg' : ''}
              {summary.weightEstimated && ' est.'}
            </p>
          </button>
        ) : (
          <div className={cardCls}>
            <p className="text-xs text-muted mb-0.5">⚖️ Weight</p>
            <p className={valueCls}>{summary.weight ? `${summary.weight}` : '—'}</p>
            <p className="text-xs text-muted">
              {summary.weight ? 'kg' : ''}
              {summary.weightEstimated && ' est.'}
            </p>
          </div>
        )}
        <div className={cardCls}>
          <p className="text-xs text-muted mb-0.5">🧍‍♀️ BMR (calculated)</p>
          <p className={valueCls}>{summary.bmr ?? '—'}</p>
          <p className="text-xs text-muted">{summary.bmr ? 'kcal' : ''}</p>
        </div>
        {interactive ? (
          <button onClick={onTapExercise} className={`${cardCls} text-left active:scale-95 transition-transform`}>
            <p className="text-xs text-muted mb-0.5">🏃‍♀️ Exercise</p>
            <p className={valueCls}>{summary.exerciseKcal ?? '—'}</p>
            <p className="text-xs text-muted">{summary.exerciseKcal !== null ? 'kcal' : 'tap to log'}</p>
          </button>
        ) : (
          <div className={cardCls}>
            <p className="text-xs text-muted mb-0.5">🏃‍♀️ Exercise</p>
            <p className={valueCls}>{summary.exerciseKcal ?? '—'}</p>
            <p className="text-xs text-muted">{summary.exerciseKcal !== null ? 'kcal' : '—'}</p>
          </div>
        )}
        {interactive ? (
          <button onClick={onTapResting} className={`${cardCls} text-left active:scale-95 transition-transform`}>
            <p className="text-xs text-muted mb-0.5">🧘‍♀️ Resting Energy</p>
            <p className={valueCls}>{summary.restingKcal ?? '—'}</p>
            <p className="text-xs text-muted">{summary.restingKcal ? 'kcal · logged' : 'tap to log'}</p>
          </button>
        ) : (
          <div className={cardCls}>
            <p className="text-xs text-muted mb-0.5">🧘‍♀️ Resting Energy</p>
            <p className={valueCls}>{summary.restingKcal ?? '—'}</p>
            <p className="text-xs text-muted">{summary.restingKcal ? 'kcal · logged' : '—'}</p>
          </div>
        )}
      </div>
    </>
  )
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
  const { navPosition, layoutWidth, isCompactHeight } = useDuoLayout()
  // Inner-landscape specifically (side nav + regular width — inner-portrait
  // uses bottom nav per Apple's HIG, so this combination only matches
  // inner-landscape): show today and the day before side by side instead of
  // just today, since there's width to spare but not much height either.
  const showDualDay = navPosition === 'side' && layoutWidth === 'regular'
  const [greeting, setGreeting] = useState('')
  const [summary, setSummary] = useState<DailySummary>(initialSummary)
  const [prevDaySummary, setPrevDaySummary] = useState<DailySummary | null>(null)
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
  // Day the log sheets save to: the selected date, or the day before it when
  // editing the left panel of the dual-day view
  const [editDate, setEditDate] = useState<string | null>(null)
  // Bumped after saving to the previous day, to refetch its panel
  const [prevDayVersion, setPrevDayVersion] = useState(0)
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

  // Fetch the day before whichever date is selected, only while the dual-day
  // view is actually showing it — avoids the extra request everywhere else.
  useEffect(() => {
    if (!showDualDay) return
    const prevDate = shiftDate(date, -1)
    let cancelled = false
    fetch(`/api/summary/${prevDate}`)
      .then((r) => r.json())
      .then((data: DailySummary) => { if (!cancelled) setPrevDaySummary(data) })
      .catch(() => { if (!cancelled) setPrevDaySummary(null) })
    return () => { cancelled = true }
  }, [showDualDay, date, prevDayVersion])

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
        body: JSON.stringify({ date: editDate ?? date, weight: Number(weightValue) }),
      })
      setMessage('Weight saved!')
      setWeightSheet(false)
      fetchSummary(date)
      if (editDate && editDate !== date) setPrevDayVersion((v) => v + 1)
    } catch {
      setMessage('Failed to save weight')
    } finally {
      setLoading(false)
    }
  }, [weightValue, date, editDate, fetchSummary])

  const handleExerciseSubmit = useCallback(async () => {
    if (!exerciseValue || isNaN(Number(exerciseValue))) return
    setLoading(true)
    try {
      await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: editDate ?? date, exerciseKcal: Number(exerciseValue) }),
      })
      setMessage('Exercise logged!')
      setExerciseSheet(false)
      fetchSummary(date)
      if (editDate && editDate !== date) setPrevDayVersion((v) => v + 1)
    } catch {
      setMessage('Failed to save exercise')
    } finally {
      setLoading(false)
    }
  }, [exerciseValue, date, editDate, fetchSummary])

  const handleRestingSubmit = useCallback(async () => {
    if (!restingValue || isNaN(Number(restingValue))) return
    setLoading(true)
    try {
      await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: editDate ?? date, restingKcal: Number(restingValue) }),
      })
      setMessage('Resting energy logged!')
      setRestingSheet(false)
      fetchSummary(date)
      if (editDate && editDate !== date) setPrevDayVersion((v) => v + 1)
    } catch {
      setMessage('Failed to save resting energy')
    } finally {
      setLoading(false)
    }
  }, [restingValue, date, editDate, fetchSummary])

  const prevDate = shiftDate(date, -1)

  // Open a log sheet for the day shown in a panel, prefilled from that day
  const openEditor = (sheet: 'weight' | 'exercise' | 'resting', day: DailySummary) => {
    setEditDate(day.date)
    if (sheet === 'weight') { setWeightValue(day.weight?.toString() ?? ''); setWeightSheet(true) }
    if (sheet === 'exercise') { setExerciseValue(defaultInputValue(day.exerciseKcal, day.avgExerciseKcal7d)); setExerciseSheet(true) }
    if (sheet === 'resting') { setRestingValue(defaultInputValue(day.restingKcal, day.avgRestingKcal7d)); setRestingSheet(true) }
  }
  const editSummary = editDate && editDate !== date && prevDaySummary ? prevDaySummary : summary
  const editLabel = editDate && editDate !== date ? ` · ${isToday ? 'Yesterday' : formatDate(prevDate)}` : ''

  return (
    <div className={`mx-auto px-4 duo-inner-l:px-6 ${showDualDay ? 'max-w-4xl' : 'max-w-md'} ${isCompactHeight ? 'pt-3' : 'pt-6'} ${navPosition === 'side' ? 'pb-6' : 'pb-24'}`}>
      {/* Header with date nav */}
      <div className={isCompactHeight ? 'mb-3' : 'mb-6'}>
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

      {/* Ring chart + stat grid. On inner-landscape, the day before (left)
          and today (right) render side by side instead of just today. */}
      {showDualDay ? (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-center text-sm font-semibold text-muted mb-3">
              {isToday ? 'Yesterday' : formatDate(prevDate)}
            </p>
            {prevDaySummary ? (
              <DayPanel
                summary={prevDaySummary}
                isCompactHeight={isCompactHeight}
                interactive
                onTapWeight={() => openEditor('weight', prevDaySummary)}
                onTapExercise={() => openEditor('exercise', prevDaySummary)}
                onTapResting={() => openEditor('resting', prevDaySummary)}
              />
            ) : (
              <p className="text-center text-xs text-muted py-10">Loading…</p>
            )}
          </div>
          <div>
            <p className="text-center text-sm font-semibold text-muted mb-3">
              {isToday ? 'Today' : formatDate(date)}
            </p>
            <DayPanel
              summary={summary}
              isCompactHeight={isCompactHeight}
              interactive
              onTapWeight={() => openEditor('weight', summary)}
              onTapExercise={() => openEditor('exercise', summary)}
              onTapResting={() => openEditor('resting', summary)}
            />
          </div>
        </div>
      ) : (
        <DayPanel
          summary={summary}
          isCompactHeight={isCompactHeight}
          interactive
          onTapWeight={() => openEditor('weight', summary)}
          onTapExercise={() => openEditor('exercise', summary)}
          onTapResting={() => openEditor('resting', summary)}
        />
      )}

      {/* Weight Sheet */}
      <Sheet isOpen={weightSheet} onClose={() => setWeightSheet(false)} title={`Log Weight${editLabel}`}>
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
      <Sheet isOpen={exerciseSheet} onClose={() => setExerciseSheet(false)} title={`Log Exercise${editLabel}`}>
        <div className="space-y-4">
          {editSummary.exerciseKcal === null && editSummary.avgExerciseKcal7d !== null && (
            <p className="text-xs text-muted -mt-2">
              Prefilled with your 7-day average ({editSummary.avgExerciseKcal7d} kcal) — adjust if today's different.
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
      <Sheet isOpen={restingSheet} onClose={() => setRestingSheet(false)} title={`Log Resting Energy${editLabel}`}>
        <div className="space-y-4">
          <p className="text-xs text-muted -mt-2">
            From your Apple Watch/iPhone Health app (Health → Resting Energy). Once logged, this replaces the calculated BMR in today&apos;s burn total.
          </p>
          {editSummary.restingKcal === null && editSummary.avgRestingKcal7d !== null && (
            <p className="text-xs text-muted -mt-2">
              Prefilled with your 7-day average ({editSummary.avgRestingKcal7d} kcal) — adjust if today's different.
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
