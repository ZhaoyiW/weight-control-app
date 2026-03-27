'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, Check, User, Cake, Ruler, Flame, Calendar, Sparkles } from 'lucide-react'
import { today } from '@/lib/utils'
import DatePicker from '@/components/ui/DatePicker'
import {
  calcBMI, getBMICategory, BMI_COLORS, BMI_TEXT_COLORS,
  generateHealthInsights, type DayActivity, type HealthInsights,
} from '@/lib/health'

// ── helpers ───────────────────────────────────────────────────────

function calcAge(birthday: string): number {
  const d = new Date()
  const dob = new Date(birthday)
  let age = d.getFullYear() - dob.getFullYear()
  const m = d.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && d.getDate() < dob.getDate())) age--
  return age
}

function formatDaysToGo(days: number): string {
  if (days <= 6) return `${days}d`
  if (days <= 13) return '~1 wk'
  if (days <= 20) return '~2 wk'
  if (days <= 55) return '~1 mo'
  if (days <= 75) return '~2 mo'
  if (days <= 100) return '~3 mo'
  return `~${Math.round(days / 30)} mo`
}

function targetDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function targetMonthYear(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Convert stored goalDays → YYYY-MM-DD date string
function daysToDateStr(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Convert a YYYY-MM-DD date string → days from today (min 1)
function dateStrToDays(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.max(1, Math.round((target.getTime() - now.getTime()) / 86400000))
}

interface PaceFeedback {
  emoji: string
  label: string
  sublabel: string
}

function getPaceFeedback(dailyDeficit: number): PaceFeedback {
  if (dailyDeficit < 300) return { emoji: '😊', label: 'Easy pace', sublabel: 'Very sustainable' }
  if (dailyDeficit < 500) return { emoji: '🌿', label: 'Steady pace', sublabel: 'Comfortable' }
  if (dailyDeficit < 750) return { emoji: '✨', label: 'Active pace', sublabel: 'Consistent effort needed' }
  return { emoji: '⚡', label: 'Ambitious pace', sublabel: 'Challenging' }
}

// ── BMI Scale component ───────────────────────────────────────────

// Display range: BMI 13–38 (practical coverage)
const BMI_MIN = 13
const BMI_MAX = 38

const BMI_SEGMENTS = [
  { label: 'Under', upTo: 18.5, color: BMI_COLORS.Underweight },
  { label: 'Normal', upTo: 25,   color: BMI_COLORS.Normal },
  { label: 'Over',  upTo: 30,   color: BMI_COLORS.Overweight },
  { label: 'Obese', upTo: BMI_MAX, color: BMI_COLORS.Obese },
]

function BMIScale({ bmi }: { bmi: number }) {
  const clampedBMI = Math.max(BMI_MIN, Math.min(BMI_MAX, bmi))
  const pct = ((clampedBMI - BMI_MIN) / (BMI_MAX - BMI_MIN)) * 100

  // Segment widths as % of display range (13–38 = 25 units)
  const range = BMI_MAX - BMI_MIN
  const segments = [
    { ...BMI_SEGMENTS[0], width: ((18.5 - BMI_MIN) / range) * 100 },
    { ...BMI_SEGMENTS[1], width: ((25 - 18.5) / range) * 100 },
    { ...BMI_SEGMENTS[2], width: ((30 - 25) / range) * 100 },
    { ...BMI_SEGMENTS[3], width: ((BMI_MAX - 30) / range) * 100 },
  ]

  return (
    <div className="mt-2">
      {/* Bar */}
      <div className="relative flex h-3 rounded-full overflow-hidden">
        {segments.map((seg, i) => (
          <div key={i} style={{ width: `${seg.width}%`, background: seg.color }} />
        ))}
      </div>

      {/* Indicator */}
      <div className="relative h-4" style={{ marginTop: '-2px' }}>
        <div
          className="absolute flex flex-col items-center"
          style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
        >
          {/* Triangle */}
          <div
            className="w-0 h-0"
            style={{
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: `6px solid ${BMI_COLORS[getBMICategory(bmi)]}`,
            }}
          />
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-0.5">
        {segments.map((seg, i) => (
          <div key={i} style={{ width: `${seg.width}%` }} className="text-center">
            <span className="text-[9px] text-muted">{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Health score ring ─────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  const color = score >= 75 ? '#a8b5a2' : score >= 50 ? '#D4B896' : '#c4847a'

  return (
    <svg width={72} height={72} viewBox="0 0 72 72">
      <circle cx={36} cy={36} r={r} fill="none" stroke="#f0ece8" strokeWidth={6} />
      <circle
        cx={36} cy={36} r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x={36} y={40} textAnchor="middle" fontSize={16} fontWeight={700} fill="#3d3530">
        {score}
      </text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────

interface UserProfile {
  name: string
  gender: string
  birthday: string
  height: number
  goalWeight: string
  goalDays: string
}

export default function ProfileView() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile>({
    name: '', gender: 'female', birthday: '', height: 0, goalWeight: '', goalDays: '',
  })
  const [currentWeight, setCurrentWeight] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 2000)
  }
  const [saving, setSaving] = useState(false)
  const [editSheet, setEditSheet] = useState(false)
  const [goalSheet, setGoalSheet] = useState(false)
  const [draft, setDraft] = useState<UserProfile>({
    name: '', gender: 'female', birthday: '', height: 0, goalWeight: '', goalDays: '',
  })
  const [goalDraft, setGoalDraft] = useState({ goalWeight: '', goalDate: '' })
  const [insights, setInsights] = useState<HealthInsights | null>(null)
  const [insightRange, setInsightRange] = useState<7 | 14 | 30>(7)
  const [showTargetDatePicker, setShowTargetDatePicker] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [profileRes, weightRes] = await Promise.all([
          fetch('/api/profile'),
          fetch(`/api/weight?date=${today()}`),
        ])
        const profileData = await profileRes.json()
        const weightData = await weightRes.json()
        if (profileData) {
          const p: UserProfile = {
            name: profileData.name ?? '',
            gender: profileData.gender ?? 'female',
            birthday: profileData.birthday ?? '',
            height: profileData.height ?? 0,
            goalWeight: profileData.goalWeight?.toString() ?? '',
            goalDays: profileData.goalDays?.toString() ?? '',
          }
          setProfile(p)
          setDraft(p)
          setGoalDraft({ goalWeight: p.goalWeight, goalDate: p.goalDays ? daysToDateStr(Number(p.goalDays)) : '' })
        }
        if (weightData?.weight) setCurrentWeight(weightData.weight)
      } catch { /* ignore */ }
    }
    load()
  }, [])

  // Fetch health insights for selected range
  useEffect(() => {
    setInsights(null)
    const fetchHistory = async () => {
      const dates: string[] = []
      for (let i = 1; i <= insightRange; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        dates.push(d.toISOString().split('T')[0])
      }
      try {
        const results = await Promise.all(dates.map(d => fetch(`/api/summary/${d}`).then(r => r.json())))
        const history: DayActivity[] = results.map(s => ({
          date: s.date,
          deficit: s.deficit ?? null,
          intake: s.totalIntake ?? 0,
          weight: s.weight ?? null,
        }))
        setInsights(generateHealthInsights(history))
      } catch { /* ignore */ }
    }
    fetchHistory()
  }, [insightRange])

  const handleProfileSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          goalWeight: draft.goalWeight ? Number(draft.goalWeight) : null,
          goalDays: draft.goalDays ? Number(draft.goalDays) : null,
        }),
      })
      setProfile({ ...draft })
      setEditSheet(false)
      showMessage('Saved ✓')
      router.refresh()
    } catch {
      showMessage('Could not save')
    } finally {
      setSaving(false)
    }
  }

  const handleGoalSave = async () => {
    setSaving(true)
    try {
      const days = goalDraft.goalDate ? dateStrToDays(goalDraft.goalDate) : null
      const updated = { ...profile, goalWeight: goalDraft.goalWeight, goalDays: days?.toString() ?? '' }
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updated,
          goalWeight: goalDraft.goalWeight ? Number(goalDraft.goalWeight) : null,
          goalDays: days,
        }),
      })
      setProfile(updated)
      setGoalSheet(false)
      setMessage('Goal saved ✓')
      router.refresh()
    } catch {
      setMessage('Could not save goal')
    } finally {
      setSaving(false)
    }
  }

  // ── derived ─────────────────────────────────────────────────────
  const bmi = currentWeight && profile.height ? calcBMI(currentWeight, profile.height) : null
  const bmiCategory = bmi ? getBMICategory(bmi) : null
  const goalWeight = profile.goalWeight ? Number(profile.goalWeight) : null
  const goalDays = profile.goalDays ? Number(profile.goalDays) : null
  const weightDiff = currentWeight !== null && goalWeight !== null ? currentWeight - goalWeight : null
  const dailyDeficit =
    weightDiff !== null && goalDays
      ? Math.round((Math.abs(weightDiff) * 7700) / goalDays)
      : null
  const pace = dailyDeficit !== null ? getPaceFeedback(dailyDeficit) : null
  const hasGoal = currentWeight !== null && goalWeight !== null && goalDays !== null && dailyDeficit !== null

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-24">

      {message && (
        <div className="bg-secondary/15 border border-secondary/30 rounded-xl p-3 mb-4 text-sm text-text text-center">
          {message}
        </div>
      )}

      {/* ── Header: name + BMI ─────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm px-4 pt-4 pb-2 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-text leading-none">{profile.name || 'My Profile'}</h1>
            {profile.birthday && profile.height ? (
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1">
                  <User size={11} className="text-muted" />
                  <span className="text-[11px] text-muted">{profile.gender === 'female' ? 'F' : 'M'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Cake size={11} className="text-muted" />
                  <span className="text-[11px] text-muted">{calcAge(profile.birthday)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Ruler size={11} className="text-muted" />
                  <span className="text-[11px] text-muted">{profile.height} cm</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {bmi ? (
              <div className="flex items-baseline gap-1.5">
                <p className="text-3xl font-bold text-text leading-none">{bmi}</p>
                <div>
                  <p className="text-[10px] text-muted/60 leading-none">BMI</p>
                  <p className={`text-[11px] font-semibold leading-none mt-0.5 ${bmiCategory ? BMI_TEXT_COLORS[bmiCategory] : 'text-muted'}`}>
                    {bmiCategory}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted italic">Log weight &amp; height</p>
            )}
            <button
              onClick={() => { setDraft({ ...profile }); setEditSheet(true) }}
              className="p-1.5 rounded-xl hover:bg-bg transition-colors flex items-center justify-center"
            >
              <Pencil size={13} className="text-muted" />
            </button>
          </div>
        </div>

        {/* BMI Scale */}
        {bmi && <BMIScale bmi={bmi} />}

        <div className="flex gap-3 mt-2">
          {(['Under', 'Normal', 'Over', 'Obese'] as const).map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: Object.values(BMI_COLORS)[i] }} />
              <span className="text-[9px] text-muted">{label === 'Under' ? '<18.5' : label === 'Normal' ? '18.5–25' : label === 'Over' ? '25–30' : '≥30'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Weight Goal ───────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4 mb-3">
        <div className="flex items-center justify-between">
          {currentWeight && goalWeight ? (
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div>
                <p className="text-xl font-bold text-text leading-none">{currentWeight}</p>
                <p className="text-[10px] text-muted mt-0.5">current</p>
              </div>
              <div className="flex flex-col items-center flex-1">
                <div className="text-muted text-xs tracking-widest">──→</div>
                {weightDiff !== null && (
                  <p className="text-[10px] text-muted mt-0.5">{Math.abs(weightDiff).toFixed(1)} kg to go</p>
                )}
              </div>
              <div>
                <p className="text-xl font-bold text-primary leading-none">{goalWeight}</p>
                <p className="text-[10px] text-muted mt-0.5">goal</p>
              </div>
              {pace && (
                <span className="ml-auto text-xs bg-bg border border-border rounded-full px-2.5 py-1 flex-shrink-0">
                  {pace.emoji} {pace.label}
                </span>
              )}
            </div>
          ) : currentWeight ? (
            <div className="flex items-center justify-between flex-1">
              <div>
                <p className="text-xl font-bold text-text">{currentWeight} kg</p>
                <p className="text-xs text-muted">current weight</p>
              </div>
              <button onClick={() => { setGoalDraft({ goalWeight: profile.goalWeight, goalDate: profile.goalDays ? daysToDateStr(Number(profile.goalDays)) : '' }); setGoalSheet(true) }}
                className="text-sm text-primary font-medium">Set a goal →</button>
            </div>
          ) : (
            <p className="text-sm text-muted italic">Log your weight to get started</p>
          )}
          <button
            onClick={() => { setGoalDraft({ goalWeight: profile.goalWeight, goalDate: profile.goalDays ? daysToDateStr(Number(profile.goalDays)) : '' }); setGoalSheet(true) }}
            className="p-2 rounded-xl hover:bg-bg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ml-2 flex-shrink-0"
          >
            <Pencil size={14} className="text-muted" />
          </button>
        </div>
      </div>

      {/* ── Goal Tracker metrics ──────────────────────────────── */}
      {hasGoal && (
        <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4 mb-3">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-bg rounded-xl px-4 py-3.5 flex items-center gap-3">
              <Flame size={17} className="text-primary/70 flex-shrink-0" />
              <div>
                <p className="text-xl font-bold text-text leading-none">{dailyDeficit}</p>
                <p className="text-[11px] text-muted mt-0.5">kcal / day</p>
              </div>
            </div>
            <div className="bg-bg rounded-xl px-4 py-3.5 flex items-center gap-3">
              <Calendar size={17} className="text-primary/70 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-text leading-none">{targetDate(goalDays!)}</p>
                <p className="text-[11px] text-muted mt-0.5">{goalDays} days · {targetMonthYear(goalDays!)}</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            To reach {goalWeight} kg by {targetDate(goalDays!)}, aim for a daily deficit of {dailyDeficit} kcal.{' '}
            {pace && (pace.label === 'Easy pace' || pace.label === 'Steady pace')
              ? 'This is a comfortable, sustainable pace.'
              : pace?.label === 'Active pace'
              ? 'This takes consistent daily effort.'
              : 'Consider extending your timeline if it feels too intense.'}
          </p>
        </div>
      )}

      {/* ── AI Health Assessment ──────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-5 mb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-primary" />
            <h2 className="text-sm font-semibold text-text">AI Health Assessment</h2>
          </div>
          <div className="flex bg-bg rounded-xl p-0.5 border border-border">
            {([7, 14, 30] as const).map(r => (
              <button key={r} onClick={() => setInsightRange(r)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  insightRange === r ? 'bg-card text-text shadow-sm border border-border' : 'text-muted'
                }`}>
                {r}d
              </button>
            ))}
          </div>
        </div>

        {insights ? (
          <>
            {/* Score row */}
            <div className="flex items-center gap-4 mb-4">
              <ScoreRing score={insights.score} />
              <div className="flex-1">
                <p className="text-xs font-semibold text-text mb-0.5">
                  {insights.score >= 75 ? 'Great shape' : insights.score >= 50 ? 'Steady progress' : 'Room to grow'}
                </p>
                <p className="text-xs text-muted leading-relaxed">
                  Based on deficit consistency, intake regularity, and tracking completeness.
                </p>
              </div>
            </div>

            {/* Positives */}
            {insights.positives.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {insights.positives.map((p, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-secondary text-xs mt-0.5 flex-shrink-0">✓</span>
                    <p className="text-xs text-text">{p}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Improvements */}
            {insights.improvements.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {insights.improvements.map((imp, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[#D4B896] text-xs mt-0.5 flex-shrink-0">→</span>
                    <p className="text-xs text-muted">{imp}</p>
                  </div>
                ))}
              </div>
            )}

            {/* AI tip */}
            <div className="bg-primary/6 border border-primary/15 rounded-xl px-3.5 py-3 mt-2">
              <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-wide mb-1">AI Tip</p>
              <p className="text-xs text-text leading-relaxed">{insights.tip}</p>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted italic text-center py-4">Loading assessment…</p>
        )}
      </div>

      {/* ── Edit Personal Info sheet ──────────────────────────── */}
      {editSheet && (
        <div className="fixed inset-x-0 top-0 h-dvh z-[200] flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditSheet(false)} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="text-base font-semibold text-text">Personal Info</h2>
              <button onClick={() => setEditSheet(false)} className="p-2 rounded-xl hover:bg-bg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X size={18} className="text-muted" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-2">Name</label>
                <input type="text" placeholder="Your name"
                  value={draft.name}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-2">Gender</label>
                <div className="flex gap-3">
                  {(['female', 'male'] as const).map((g) => (
                    <button key={g} onClick={() => setDraft((p) => ({ ...p, gender: g }))}
                      className={`flex-1 py-3 rounded-xl border font-medium text-sm min-h-[48px] transition-colors ${
                        draft.gender === g ? 'bg-primary text-white border-primary' : 'bg-bg text-text border-border'
                      }`}>
                      {g === 'female' ? 'Female' : 'Male'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-2">Birthday</label>
                <input type="date" value={draft.birthday} max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDraft((p) => ({ ...p, birthday: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40" />
                {draft.birthday && (
                  <p className="text-xs text-muted mt-1.5">{calcAge(draft.birthday)} years old</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-2">Height</label>
                <div className="relative">
                  <input type="number" inputMode="decimal" step="0.1" placeholder="165"
                    value={draft.height || ''}
                    onChange={(e) => setDraft((p) => ({ ...p, height: Number(e.target.value) }))}
                    className="w-full border border-border rounded-xl px-4 py-3 pr-12 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">cm</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border">
              <button onClick={handleProfileSave} disabled={saving}
                className="w-full bg-primary text-white rounded-xl px-4 py-3 font-medium flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]">
                <Check size={15} />{saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Goal sheet ───────────────────────────────────── */}
      {goalSheet && (
        <div className="fixed inset-x-0 top-0 h-dvh z-[200] flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setGoalSheet(false)} />
          <div className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="text-base font-semibold text-text">Weight Goal</h2>
              <button onClick={() => setGoalSheet(false)} className="p-2 rounded-xl hover:bg-bg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X size={18} className="text-muted" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-2">Goal weight</label>
                <div className="relative">
                  <input type="number" inputMode="decimal" step="0.1" placeholder="48.0"
                    value={goalDraft.goalWeight}
                    onChange={(e) => setGoalDraft((p) => ({ ...p, goalWeight: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-3 pr-12 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">kg</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-2">Target date</label>
                <button
                  type="button"
                  onClick={() => setShowTargetDatePicker(true)}
                  className="w-full border border-border rounded-xl px-4 py-3 text-left bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40"
                >
                  <span className={goalDraft.goalDate ? 'text-text' : 'text-muted'}>
                    {goalDraft.goalDate
                      ? new Date(goalDraft.goalDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      : 'Select a date'}
                  </span>
                </button>
                {goalDraft.goalDate && (
                  <p className="text-xs text-muted mt-1.5">
                    {dateStrToDays(goalDraft.goalDate)} days · {formatDaysToGo(dateStrToDays(goalDraft.goalDate))}
                  </p>
                )}
              </div>
              {goalDraft.goalWeight && goalDraft.goalDate && currentWeight !== null && (() => {
                const days = dateStrToDays(goalDraft.goalDate)
                const diff = Math.abs(currentWeight - Number(goalDraft.goalWeight))
                const deficit = Math.round(diff * 7700 / days)
                const p = getPaceFeedback(deficit)
                return (
                  <div className="bg-bg rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-xl">{p.emoji}</span>
                    <div>
                      <p className="text-sm font-medium text-text">{deficit} kcal / day · {p.label}</p>
                      <p className="text-xs text-muted mt-0.5">{p.sublabel}</p>
                    </div>
                  </div>
                )
              })()}
            </div>
            <div className="px-6 py-4 border-t border-border">
              <button onClick={handleGoalSave} disabled={saving}
                className="w-full bg-primary text-white rounded-xl px-4 py-3 font-medium flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]">
                <Check size={15} />{saving ? 'Saving…' : 'Save goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTargetDatePicker && (
        <DatePicker
          value={goalDraft.goalDate || daysToDateStr(1)}
          min={daysToDateStr(1)}
          onChange={(d) => { setGoalDraft((p) => ({ ...p, goalDate: d })); setShowTargetDatePicker(false) }}
          onClose={() => setShowTargetDatePicker(false)}
        />
      )}
    </div>
  )
}
