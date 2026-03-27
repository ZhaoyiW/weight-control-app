'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Trash2, Plus, Flame, Copy, Pencil, Check, X, Utensils } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { today, formatDate } from '@/lib/utils'
import { TAB_VISIT_EVENT } from '@/components/BottomNav'
import AddMealSheet from './AddMealSheet'
import DatePicker from '@/components/ui/DatePicker'

interface FoodItem {
  id: number
  name: string
  servingUnit: string
  servingAmount: number
  kcalPerServing: number
}

interface MealEntry {
  id: number
  date: string
  mealType: string
  foodId: number | null
  food: FoodItem | null
  customName: string | null
  quantity: number
  kcal: number
}

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { key: 'lunch', label: 'Lunch', emoji: '🥗' },
  { key: 'dinner', label: 'Dinner', emoji: '🍝' },
  { key: 'snack', label: 'Snacks', emoji: '🍪' },
]

// ── Diet assessment ───────────────────────────────────────────────

interface DietInsight {
  icon: string
  text: string
  type: 'positive' | 'neutral' | 'warning'
}

function analyzeDiet(meals: MealEntry[], totalKcal: number): DietInsight[] | null {
  if (totalKcal === 0) return null

  const kcalOf = (type: string) => meals.filter(m => m.mealType === type).reduce((s, m) => s + m.kcal, 0)
  const byType = { breakfast: kcalOf('breakfast'), lunch: kcalOf('lunch'), dinner: kcalOf('dinner'), snack: kcalOf('snack') }
  const missing = (['breakfast', 'lunch', 'dinner'] as const).filter(t => byType[t] === 0)
  const insights: DietInsight[] = []

  // 1. Three meals coverage
  if (missing.length === 0) {
    insights.push({ icon: '✅', text: 'All three main meals logged — good eating rhythm.', type: 'positive' })
  } else if (missing.length === 1) {
    const name = missing[0].charAt(0).toUpperCase() + missing[0].slice(1)
    insights.push({ icon: '📋', text: `${name} not logged yet today.`, type: 'neutral' })
  } else if (missing.length >= 2) {
    insights.push({ icon: '📋', text: `Only ${3 - missing.length} of 3 main meals logged — data may be incomplete.`, type: 'neutral' })
  }

  // 2. Snack proportion
  if (byType.snack > 0) {
    const pct = Math.round(byType.snack / totalKcal * 100)
    if (pct > 35)
      insights.push({ icon: '🍪', text: `Snacks make up ${pct}% of today's intake — consider shifting more to main meals.`, type: 'warning' })
    else if (pct > 20)
      insights.push({ icon: '🍪', text: `Snacks at ${pct}% of intake — reasonable, but keep an eye on it.`, type: 'neutral' })
  }

  // 3. One meal dominating
  for (const type of ['breakfast', 'lunch', 'dinner'] as const) {
    const pct = Math.round(byType[type] / totalKcal * 100)
    if (pct > 60)
      insights.push({ icon: '⚖️', text: `${type.charAt(0).toUpperCase() + type.slice(1)} is ${pct}% of today's calories — spreading intake more evenly supports steadier energy.`, type: 'warning' })
  }

  // 4. Light breakfast warning
  if (byType.breakfast > 0 && byType.breakfast < 200 && totalKcal > 800)
    insights.push({ icon: '🌅', text: `Light breakfast (${byType.breakfast} kcal) — a bigger morning meal can reduce afternoon cravings.`, type: 'neutral' })

  // 5. Very low total
  if (totalKcal < 1000 && missing.length === 0)
    insights.push({ icon: '⚠️', text: `Total intake is quite low (${totalKcal} kcal) — make sure all meals are logged.`, type: 'warning' })

  return insights.length > 0 ? insights : null
}

// ─────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function MealsView() {
  const [date, setDate] = useState(today())
  const [meals, setMeals] = useState<MealEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [addSheet, setAddSheet] = useState<{ open: boolean; mealType: string }>({
    open: false,
    mealType: 'breakfast',
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQty, setEditQty] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const fetchMeals = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/meals?date=${d}`)
      const data = await res.json()
      setMeals(Array.isArray(data) ? data : [])
    } catch {
      setMeals([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMeals(date)
  }, [date, fetchMeals])

  useEffect(() => {
    const onTabVisit = (e: Event) => {
      if ((e as CustomEvent).detail === '/meals') setDate(today())
    }
    const onVisible = () => {
      if (!document.hidden) setDate(today())
    }
    window.addEventListener(TAB_VISIT_EVENT, onTabVisit)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener(TAB_VISIT_EVENT, onTabVisit)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const handleDelete = async (id: number) => {
    setMeals((prev) => prev.filter((m) => m.id !== id))
    await fetch(`/api/meals/${id}`, { method: 'DELETE' })
  }

  const startEdit = (entry: MealEntry) => {
    setEditingId(entry.id)
    setEditQty(String(entry.quantity))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditQty('')
  }

  const confirmEdit = async (id: number) => {
    const qty = Number(editQty)
    if (!editQty || isNaN(qty) || qty <= 0) return
    await fetch(`/api/meals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: qty }),
    })
    setEditingId(null)
    fetchMeals(date)
  }

  const handleAddMeal = async (mealType: string) => {
    setAddSheet({ open: true, mealType })
  }

  const handleMealAdded = () => {
    setAddSheet({ open: false, mealType: '' })
    fetchMeals(date)
  }

  const [copying, setCopying] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')

  const copyYesterday = async () => {
    setCopying(true)
    setCopyMsg('')
    try {
      const res = await fetch('/api/meals/copy-yesterday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      const data = await res.json()
      if (data.copied === 0) {
        setCopyMsg('No meals found for yesterday')
      } else {
        setCopyMsg(`Copied ${data.copied} items from yesterday`)
        fetchMeals(date)
      }
    } catch {
      setCopyMsg('Failed, please try again')
    } finally {
      setCopying(false)
      setTimeout(() => setCopyMsg(''), 3000)
    }
  }

  const totalKcal = meals.reduce((sum, m) => sum + m.kcal, 0)
  const isToday = date === today()
  const isFuture = date > today()
  const [showCalendar, setShowCalendar] = useState(false)

  return (
    <div className="max-w-md mx-auto px-4 pt-6">
      {/* Date selector */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setDate(addDays(date, -1))}
            className="p-2 rounded-xl hover:bg-card border border-transparent hover:border-border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ChevronLeft size={22} className="text-text" />
          </button>
          <button className="flex-1 text-center min-h-[44px] flex items-center justify-center" onClick={() => setShowCalendar(true)}>
            <p className="text-2xl font-bold text-text">{isToday ? 'Today' : formatDate(date)}</p>
          </button>
          <button
            onClick={() => setDate(addDays(date, 1))}
            disabled={isFuture}
            className="p-2 rounded-xl hover:bg-card border border-transparent hover:border-border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-30"
          >
            <ChevronRight size={22} className="text-text" />
          </button>
        </div>
        {!isToday && (
          <button onClick={() => setDate(today())} className="block mx-auto text-xs text-primary mt-1">
            Back to today
          </button>
        )}
      </div>

      {/* Total */}
      <div className="bg-primary/10 rounded-2xl border border-primary/20 p-4 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Utensils size={18} className="text-primary" />
          <span className="font-medium text-text">Total Intake</span>
        </div>
        <span className="font-bold text-text text-lg">{totalKcal} kcal</span>
      </div>

      {/* Pie chart */}
      {totalKcal > 0 && (() => {
        const pieData = MEAL_TYPES
          .map(({ key, label, emoji }) => ({
            name: emoji + ' ' + label,
            value: meals.filter((m) => m.mealType === key).reduce((s, e) => s + e.kcal, 0),
          }))
          .filter((d) => d.value > 0)
        const COLORS = ['#E6CFA3', '#B7CDB3', '#8E9AA6', '#D9A5A0']
        return (
          <div className="bg-card rounded-2xl border border-border shadow-sm px-4 py-5 mb-3">
            <div className="flex items-center">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" strokeWidth={0}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [`${val} kcal`]}
                    contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e8e4df' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 ml-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-muted">{d.name}</span>
                    </div>
                    <span className="text-xs font-medium text-text">{Math.round(d.value / totalKcal * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Copy yesterday */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={copyYesterday}
          disabled={copying}
          className="flex items-center gap-1.5 text-xs text-muted font-medium bg-card border border-border px-3 py-2 rounded-xl disabled:opacity-50 hover:border-primary/40 transition-colors"
        >
          <Copy size={13} />
          {copying ? 'Copying…' : 'Copy yesterday\'s meals'}
        </button>
        {copyMsg && <p className="text-xs text-muted">{copyMsg}</p>}
      </div>

      {loading ? (
        <div className="text-center text-muted py-12">Loading…</div>
      ) : (
        <div className="space-y-4 pb-24">
          {(() => {
            const insights = analyzeDiet(meals, totalKcal)
            if (!insights) return null
            return (
              <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4">
                <p className="text-[11px] font-medium text-muted uppercase tracking-wide mb-3">Today's Diet</p>
                <div className="space-y-2.5">
                  {insights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="text-sm leading-none mt-0.5 flex-shrink-0">{ins.icon}</span>
                      <p className={`text-xs leading-relaxed ${
                        ins.type === 'positive' ? 'text-text' : ins.type === 'warning' ? 'text-[#b8865e]' : 'text-muted'
                      }`}>{ins.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {MEAL_TYPES.map(({ key, label, emoji }) => {
            const entries = meals.filter((m) => m.mealType === key)
            const sectionKcal = entries.reduce((s, e) => s + e.kcal, 0)
            const isExpanded = expanded[key]

            return (
              <div key={key} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="font-semibold text-text">{label}</span>
                    {entries.length > 0 && (
                      <span className="text-xs text-muted">· {entries.length} items</span>
                    )}
                  </button>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-sm text-muted">{sectionKcal} kcal</span>
                    <button
                      onClick={() => handleAddMeal(key)}
                      className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors text-primary"
                    >
                      <Plus size={18} />
                    </button>
                    <ChevronRight
                      size={16}
                      className={`text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <>
                <div className="divide-y divide-border border-t border-border">
                  {entries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{entry.food?.name ?? entry.customName}</p>
                        {editingId === entry.id ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && confirmEdit(entry.id)}
                              className="w-20 border border-border rounded-lg px-2 py-1 text-xs text-text bg-bg focus:outline-none focus:ring-2 focus:ring-primary/40"
                              autoFocus
                            />
                            <span className="text-xs text-muted">{entry.food ? entry.food.servingUnit : 'kcal'}</span>
                          </div>
                        ) : (
                          <p className="text-xs text-muted">
                            {entry.food ? `${entry.quantity} ${entry.food.servingUnit} · ` : ''}{entry.kcal} kcal
                          </p>
                        )}
                      </div>
                      {editingId === entry.id ? (
                        <div className="flex items-center gap-1 ml-3">
                          <button
                            onClick={() => confirmEdit(entry.id)}
                            className="p-2 rounded-lg hover:bg-primary/10 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                          >
                            <Check size={16} className="text-primary" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-2 rounded-lg hover:bg-bg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                          >
                            <X size={16} className="text-muted" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 ml-3">
                          <button
                            onClick={() => startEdit(entry)}
                            className="p-2 rounded-lg hover:bg-bg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                          >
                            <Pencil size={15} className="text-muted" />
                          </button>
                          <button
                            onClick={(e) => { e.currentTarget.blur(); handleDelete(entry.id) }}
                            className="p-2 rounded-lg hover:bg-danger/10 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                          >
                            <Trash2 size={16} className="text-danger" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                  </>
                )}

              </div>
            )
          })}
        </div>
      )}

      {addSheet.open && (

        <AddMealSheet
          date={date}
          mealType={addSheet.mealType}
          onClose={() => setAddSheet({ open: false, mealType: '' })}
          onAdded={handleMealAdded}
        />
      )}
      {showCalendar && (
        <DatePicker
          value={date}
          max={today()}
          onChange={(d) => setDate(d)}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  )
}
