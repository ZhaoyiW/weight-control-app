'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Search, Globe, Check } from 'lucide-react'

interface FoodItem {
  id?: number
  name: string
  servingUnit: string
  servingAmount: number
  kcalPerServing: number
}

interface AddMealSheetProps {
  date: string
  mealType: string
  onClose: () => void
  onAdded: () => void
}

export default function AddMealSheet({ date, mealType, onClose, onAdded }: AddMealSheetProps) {
  const [mode, setMode] = useState<'library' | 'custom'>('library')
  const [query, setQuery] = useState('')
  const [localResults, setLocalResults] = useState<FoodItem[]>([])
  const [onlineResults, setOnlineResults] = useState<FoodItem[]>([])
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null)
  const [quantity, setQuantity] = useState('')
  const [customKcal, setCustomKcal] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchingOnline, setSearchingOnline] = useState(false)
  const [onlineError, setOnlineError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showOnline, setShowOnline] = useState(false)
  // Custom mode fields
  const [customName, setCustomName] = useState('')
  const [customTotalKcal, setCustomTotalKcal] = useState('')

  const searchLocal = useCallback(async (q: string) => {
    if (!q.trim()) {
      setLocalResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/foods?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setLocalResults(Array.isArray(data) ? data : [])
    } catch {
      setLocalResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => searchLocal(query), 300)
    return () => clearTimeout(timer)
  }, [query, searchLocal])

  const searchOnline = async () => {
    setSearchingOnline(true)
    setShowOnline(true)
    setOnlineError('')
    try {
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data.error) {
        setOnlineError(data.error === 'ANTHROPIC_API_KEY not configured'
          ? 'API key not configured. Add ANTHROPIC_API_KEY to .env'
          : 'Search failed, please try again')
        setOnlineResults([])
      } else {
        setOnlineResults(data.results ?? [])
      }
    } catch {
      setOnlineError('Search failed, please try again')
      setOnlineResults([])
    } finally {
      setSearchingOnline(false)
    }
  }

  const selectFood = (food: FoodItem) => {
    setSelectedFood(food)
    setQuantity(food.servingAmount.toString())
    setCustomKcal(food.kcalPerServing > 0 ? '' : '')
    setLocalResults([])
    setOnlineResults([])
    setShowOnline(false)
  }

  const effectiveKcalPerServing = () => {
    if (!selectedFood) return 0
    if (selectedFood.kcalPerServing === 0 && customKcal) return Number(customKcal)
    return selectedFood.kcalPerServing
  }

  const previewKcal = () => {
    if (!selectedFood || !quantity) return 0
    return Math.round((effectiveKcalPerServing() / selectedFood.servingAmount) * Number(quantity))
  }

  const handleSubmit = async () => {
    if (!selectedFood || !quantity) return
    setSubmitting(true)

    try {
      let foodId = selectedFood.id

      // If food came from online search (no id), create it first
      if (!foodId) {
        const createRes = await fetch('/api/foods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: selectedFood.name,
            servingUnit: selectedFood.servingUnit,
            servingAmount: selectedFood.servingAmount,
            kcalPerServing: effectiveKcalPerServing(),
          }),
        })
        const created = await createRes.json()
        foodId = created.id
      }

      await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, mealType, foodId, quantity: Number(quantity) }),
      })

      onAdded()
    } catch {
      // handle error silently
    } finally {
      setSubmitting(false)
    }
  }

  const handleCustomSubmit = async () => {
    if (!customName.trim() || !customTotalKcal) return
    setSubmitting(true)
    try {
      // Create a one-off food item (1 serving = total kcal entered)
      const createRes = await fetch('/api/foods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName.trim(),
          servingUnit: 'serving',
          servingAmount: 1,
          kcalPerServing: Number(customTotalKcal),
        }),
      })
      const created = await createRes.json()

      await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, mealType, foodId: created.id, quantity: 1 }),
      })

      onAdded()
    } catch {
      // handle error silently
    } finally {
      setSubmitting(false)
    }
  }

  const allResults = showOnline ? onlineResults : localResults

  return (
    <div className="fixed inset-x-0 top-0 h-dvh z-[200] flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold text-text">Add Food</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-bg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} className="text-muted" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="px-6 pb-4">
          <div className="flex bg-bg rounded-xl p-1 border border-border">
            <button
              onClick={() => setMode('library')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'library' ? 'bg-card text-text shadow-sm' : 'text-muted'}`}
            >
              Library
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'custom' ? 'bg-card text-text shadow-sm' : 'text-muted'}`}
            >
              Custom
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {/* Custom mode */}
          {mode === 'custom' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Dinner at restaurant"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full border border-border rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Estimated Calories (kcal)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="10"
                  placeholder="e.g. 600"
                  value={customTotalKcal}
                  onChange={(e) => setCustomTotalKcal(e.target.value)}
                  className="w-full border border-border rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40 text-lg"
                />
              </div>
            </div>
          )}

          {/* Search */}
          {mode === 'library' && !selectedFood && (
            <div className="mb-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search food..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setShowOnline(false)
                    setOnlineResults([])
                  }}
                  className="w-full border border-border rounded-xl pl-9 pr-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40"
                  autoFocus
                />
              </div>

              {/* Results */}
              {searching && (
                <p className="text-xs text-muted text-center py-4">Searching…</p>
              )}

              {!searching && allResults.length > 0 && (
                <div className="mt-2 bg-bg rounded-xl border border-border overflow-hidden">
                  {allResults.map((food, i) => (
                    <button
                      key={food.id ?? i}
                      onClick={() => selectFood(food)}
                      className="w-full text-left px-4 py-3 hover:bg-card transition-colors border-b border-border last:border-0"
                    >
                      <p className="text-sm font-medium text-text">{food.name}</p>
                      <p className="text-xs text-muted">
                        {food.servingAmount} {food.servingUnit} · {food.kcalPerServing} kcal
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {!searching && query.trim() && localResults.length === 0 && !showOnline && (
                <div className="mt-3 text-center">
                  <p className="text-sm text-muted mb-3">No local results</p>
                  <button
                    onClick={searchOnline}
                    className="flex items-center gap-2 mx-auto text-primary text-sm font-medium bg-primary/10 px-4 py-2 rounded-xl min-h-[44px]"
                  >
                    <Globe size={16} />
                    Search online
                  </button>
                </div>
              )}

              {searchingOnline && (
                <p className="text-xs text-muted text-center py-4">🔍 Looking up calories with AI…</p>
              )}

              {showOnline && !searchingOnline && onlineError && (
                <p className="text-xs text-danger text-center py-4">{onlineError}</p>
              )}

              {showOnline && !searchingOnline && !onlineError && onlineResults.length === 0 && (
                <p className="text-xs text-muted text-center py-4">No results found</p>
              )}
            </div>
          )}

          {/* Selected food + quantity */}
          {mode === 'library' && selectedFood && (
            <div className="space-y-4">
              <div className="flex items-start justify-between bg-primary/10 rounded-xl p-4">
                <div>
                  <p className="font-medium text-text">{selectedFood.name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {selectedFood.kcalPerServing} kcal per {selectedFood.servingAmount} {selectedFood.servingUnit}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFood(null)
                    setQuantity('')
                  }}
                  className="p-1.5 rounded-lg hover:bg-primary/20 transition-colors"
                >
                  <X size={16} className="text-primary" />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Quantity ({selectedFood.servingUnit})
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  placeholder={`e.g. ${selectedFood.servingAmount}`}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full border border-border rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40 text-lg"
                  autoFocus
                />
              </div>

              {selectedFood.kcalPerServing === 0 && (
                <div>
                  <label className="block text-sm font-medium text-text mb-2">
                    Kcal per serving <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="1"
                    placeholder="e.g. 200"
                    value={customKcal}
                    onChange={(e) => setCustomKcal(e.target.value)}
                    className="w-full border border-danger/50 rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-danger/30 text-lg"
                  />
                  <p className="text-xs text-muted mt-1">Not found online — please enter calories manually</p>
                </div>
              )}

              {quantity && (
                <div className="bg-accent/15 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm text-text">Estimated calories</span>
                  <span className="font-bold text-text">{previewKcal()} kcal</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pinned submit buttons */}
        {mode === 'custom' && (
          <div className="px-6 py-4">
            <button
              onClick={handleCustomSubmit}
              disabled={submitting || !customName.trim() || !customTotalKcal}
              className="w-full bg-primary text-white rounded-xl px-4 py-3 font-medium flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
            >
              <Check size={18} />
              {submitting ? 'Adding…' : 'Add to Meal'}
            </button>
          </div>
        )}
        {mode === 'library' && selectedFood && (
          <div className="px-6 py-4">
            <button
              onClick={handleSubmit}
              disabled={submitting || !quantity || (selectedFood.kcalPerServing === 0 && !customKcal)}
              className="w-full bg-primary text-white rounded-xl px-4 py-3 font-medium flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
            >
              <Check size={18} />
              {submitting ? 'Adding…' : 'Add to Meal'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
