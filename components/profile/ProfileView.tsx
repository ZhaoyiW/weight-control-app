'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, Check } from 'lucide-react'
import { today } from '@/lib/utils'

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
  if (days <= 6) return `${days} day${days !== 1 ? 's' : ''} to go`
  if (days <= 13) return 'About a week to go'
  if (days <= 20) return 'About 2 weeks to go'
  if (days <= 34) return 'About a month to go'
  if (days <= 55) return 'About 6 weeks to go'
  if (days <= 75) return 'About 2 months to go'
  if (days <= 100) return 'About 3 months to go'
  return `About ${Math.round(days / 30)} months to go`
}

function addDaysToToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface PaceFeedback {
  emoji: string
  label: string
  sublabel: string
  heroLine: string
}

function getPaceFeedback(dailyDeficit: number): PaceFeedback {
  if (dailyDeficit < 300)
    return {
      emoji: '😊',
      label: 'Easy pace',
      sublabel: 'A very sustainable rhythm',
      heroLine: 'Easy pace, keep it up ✨',
    }
  if (dailyDeficit < 500)
    return {
      emoji: '🌿',
      label: 'Steady pace',
      sublabel: 'Comfortable and achievable',
      heroLine: 'A steady rhythm is working 🌿',
    }
  if (dailyDeficit < 750)
    return {
      emoji: '✨',
      label: 'Active pace',
      sublabel: 'Requires consistent daily effort',
      heroLine: 'Ambitious but doable ✨',
    }
  return {
    emoji: '⚡',
    label: 'Ambitious pace',
    sublabel: 'Consider consulting a nutritionist',
    heroLine: 'A bold goal — pace yourself ⚡',
  }
}

// ─────────────────────────────────────────────────────────────────

interface UserProfile {
  gender: string
  birthday: string
  height: number
  goalWeight: string
  goalDays: string
}

export default function ProfileView() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile>({
    gender: 'female', birthday: '', height: 0, goalWeight: '', goalDays: '',
  })
  const [currentWeight, setCurrentWeight] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [editSheet, setEditSheet] = useState(false)
  const [goalSheet, setGoalSheet] = useState(false)
  const [draft, setDraft] = useState<UserProfile>({
    gender: 'female', birthday: '', height: 0, goalWeight: '', goalDays: '',
  })
  const [goalDraft, setGoalDraft] = useState({ goalWeight: '', goalDays: '' })

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
            gender: profileData.gender ?? 'female',
            birthday: profileData.birthday ?? '',
            height: profileData.height ?? 0,
            goalWeight: profileData.goalWeight?.toString() ?? '',
            goalDays: profileData.goalDays?.toString() ?? '',
          }
          setProfile(p)
          setDraft(p)
          setGoalDraft({ goalWeight: p.goalWeight, goalDays: p.goalDays })
        }
        if (weightData?.weight) setCurrentWeight(weightData.weight)
      } catch { /* ignore */ }
    }
    load()
  }, [])

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
      setMessage('Saved ✓')
      router.refresh()
    } catch {
      setMessage('Could not save')
    } finally {
      setSaving(false)
    }
  }

  const handleGoalSave = async () => {
    setSaving(true)
    try {
      const updated = { ...profile, ...goalDraft }
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updated,
          goalWeight: goalDraft.goalWeight ? Number(goalDraft.goalWeight) : null,
          goalDays: goalDraft.goalDays ? Number(goalDraft.goalDays) : null,
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

  // derived values
  const goalWeight = profile.goalWeight ? Number(profile.goalWeight) : null
  const goalDays = profile.goalDays ? Number(profile.goalDays) : null
  const weightDiff = currentWeight !== null && goalWeight !== null ? currentWeight - goalWeight : null
  const totalKcal = weightDiff !== null ? Math.abs(weightDiff) * 7700 : null
  const dailyDeficit = totalKcal !== null && goalDays ? Math.round(totalKcal / goalDays) : null
  const pace = dailyDeficit !== null ? getPaceFeedback(dailyDeficit) : null

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-28">
      <h1 className="text-2xl font-bold text-text mb-5">Profile</h1>

      {message && (
        <div className="bg-secondary/15 border border-secondary/30 rounded-xl p-3 mb-4 text-sm text-text text-center">
          {message}
        </div>
      )}

      {/* ── Hero summary card ─────────────────────────────── */}
      {currentWeight !== null && goalWeight !== null && (
        <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 mb-4">
          {/* current → goal */}
          <div className="flex items-center gap-3 mb-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-text">{currentWeight}</p>
              <p className="text-xs text-muted mt-0.5">now</p>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full h-px bg-border relative">
                <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-muted bg-transparent px-1">
                  {weightDiff !== null ? `${Math.abs(weightDiff).toFixed(1)} kg to go` : ''}
                </span>
              </div>
              <div className="flex items-center gap-0.5 mt-2">
                <span className="text-[10px] text-muted/60">──────→</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{goalWeight}</p>
              <p className="text-xs text-muted mt-0.5">goal</p>
            </div>
          </div>

          {pace && (
            <p className="text-sm text-muted text-center">{pace.heroLine}</p>
          )}
          {!pace && goalDays && (
            <p className="text-sm text-muted text-center">
              {formatDaysToGo(goalDays)}
            </p>
          )}
        </div>
      )}

      {/* ── Personal Info ─────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4 mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium text-muted uppercase tracking-wide mb-1">About me</p>
          {profile.birthday && profile.height ? (
            <p className="text-sm text-text">
              {profile.gender === 'female' ? 'Female' : 'Male'} · {calcAge(profile.birthday)} · {profile.height} cm
            </p>
          ) : (
            <p className="text-sm text-muted italic">Not set yet</p>
          )}
        </div>
        <button
          onClick={() => { setDraft({ ...profile }); setEditSheet(true) }}
          className="p-2 rounded-xl hover:bg-bg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
        >
          <Pencil size={15} className="text-muted" />
        </button>
      </div>

      {/* ── Weight Goal ───────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4 mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium text-muted uppercase tracking-wide mb-1">Weight goal</p>
          {profile.goalWeight ? (
            <div>
              <p className="text-sm text-text">{profile.goalWeight} kg target</p>
              {profile.goalDays && (
                <p className="text-xs text-muted mt-0.5">{formatDaysToGo(Number(profile.goalDays))}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted italic">Not set yet</p>
          )}
        </div>
        <button
          onClick={() => {
            setGoalDraft({ goalWeight: profile.goalWeight, goalDays: profile.goalDays })
            setGoalSheet(true)
          }}
          className="p-2 rounded-xl hover:bg-bg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
        >
          <Pencil size={15} className="text-muted" />
        </button>
      </div>

      {/* ── Goal Tracker ──────────────────────────────────── */}
      {goalWeight !== null && currentWeight !== null && goalDays !== null && dailyDeficit !== null && pace !== null && (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 mb-3">
          <p className="text-[11px] font-medium text-muted uppercase tracking-wide mb-4">Goal tracker</p>

          {/* Progress bar */}
          <div className="flex items-center justify-between text-xs text-muted mb-1.5">
            <span>{currentWeight} kg</span>
            <span className="font-medium text-text">
              {Math.abs(weightDiff!).toFixed(1)} kg to go
            </span>
            <span>{goalWeight} kg</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden mb-5">
            <div
              className="h-full rounded-full bg-primary/60 transition-all"
              style={{
                width: `${Math.min(95, Math.max(5, (1 - Math.abs(weightDiff!) / (Math.abs(weightDiff!) + 1)) * 100))}%`,
              }}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-bg rounded-xl p-3">
              <p className="text-[11px] text-muted mb-1">Daily deficit needed</p>
              <p className="text-lg font-bold text-text">{dailyDeficit}</p>
              <p className="text-[11px] text-muted">kcal / day</p>
            </div>
            <div className="bg-bg rounded-xl p-3">
              <p className="text-[11px] text-muted mb-1">Target date</p>
              <p className="text-sm font-semibold text-text leading-snug">{addDaysToToday(goalDays)}</p>
              <p className="text-[11px] text-muted">{formatDaysToGo(goalDays)}</p>
            </div>
          </div>

          {/* Pace feedback */}
          <div className="flex items-start gap-3 bg-bg rounded-xl px-4 py-3">
            <span className="text-xl mt-0.5">{pace.emoji}</span>
            <div>
              <p className="text-sm font-medium text-text">{pace.label}</p>
              <p className="text-xs text-muted mt-0.5">{pace.sublabel}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Personal Info sheet ──────────────────────── */}
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

      {/* ── Edit Goal sheet ───────────────────────────────── */}
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
                <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-2">Days to reach goal</label>
                <input type="number" inputMode="numeric" placeholder="90"
                  value={goalDraft.goalDays}
                  onChange={(e) => setGoalDraft((p) => ({ ...p, goalDays: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40" />
                {goalDraft.goalDays && (
                  <p className="text-xs text-muted mt-1.5">
                    {formatDaysToGo(Number(goalDraft.goalDays))} · {addDaysToToday(Number(goalDraft.goalDays))}
                  </p>
                )}
              </div>
              {goalDraft.goalWeight && goalDraft.goalDays && currentWeight !== null && (() => {
                const diff = Math.abs(currentWeight - Number(goalDraft.goalWeight))
                const deficit = Math.round(diff * 7700 / Number(goalDraft.goalDays))
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
    </div>
  )
}
