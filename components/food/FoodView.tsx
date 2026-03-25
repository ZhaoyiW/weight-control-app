'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Pencil, Trash2, Plus, Globe } from 'lucide-react'
import AddFoodSheet from './AddFoodSheet'

interface FoodItem {
  id?: number
  name: string
  category?: string | null
  servingUnit: string
  servingAmount: number
  kcalPerServing: number
}

const CATEGORIES = ['Carbs', 'Protein', 'Fat', 'Vegetables', 'Fruits', 'Dairy', 'Drinks', 'Snacks', 'Processed', 'Condiments', 'Other']

const CATEGORY_COLORS: Record<string, string> = {
  'Carbs':      'bg-stone-100 text-stone-400',
  'Protein':    'bg-slate-100 text-slate-400',
  'Fat':        'bg-stone-100 text-stone-400',
  'Vegetables': 'bg-stone-100 text-stone-400',
  'Fruits':     'bg-stone-100 text-stone-400',
  'Dairy':      'bg-slate-100 text-slate-400',
  'Drinks':     'bg-stone-100 text-stone-400',
  'Snacks':     'bg-stone-100 text-stone-400',
  'Processed':  'bg-neutral-100 text-neutral-400',
  'Condiments': 'bg-stone-100 text-stone-400',
  'Other':      'bg-gray-100 text-gray-400',
}

export default function FoodView() {
  const [foods, setFoods] = useState<FoodItem[]>([])
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [addSheet, setAddSheet] = useState(false)
  const [editFood, setEditFood] = useState<FoodItem | null>(null)

  // Online search state
  const [onlineResults, setOnlineResults] = useState<FoodItem[]>([])
  const [searchingOnline, setSearchingOnline] = useState(false)
  const [showOnline, setShowOnline] = useState(false)
  const [addingFood, setAddingFood] = useState<number | null>(null)

  const fetchFoods = useCallback(async (q: string, category: string | null) => {
    setLoading(true)
    setShowOnline(false)
    setOnlineResults([])
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q)
      if (category) params.set('category', category)
      const url = `/api/foods${params.toString() ? '?' + params.toString() : ''}`
      const res = await fetch(url)
      const data = await res.json()
      setFoods(Array.isArray(data) ? data : [])
    } catch {
      setFoods([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => fetchFoods(query, activeCategory), 300)
    return () => clearTimeout(timer)
  }, [query, activeCategory, fetchFoods])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this food? Any meal entries using it will also be removed.')) return
    await fetch(`/api/foods/${id}`, { method: 'DELETE' })
    fetchFoods(query, activeCategory)
  }

  const handleSaved = () => {
    setAddSheet(false)
    setEditFood(null)
    fetchFoods(query, activeCategory)
  }

  const searchOnline = async () => {
    if (!query.trim()) return
    setSearchingOnline(true)
    setShowOnline(true)
    try {
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setOnlineResults(data.results ?? [])
    } catch {
      setOnlineResults([])
    } finally {
      setSearchingOnline(false)
    }
  }

  const addOnlineFood = async (food: FoodItem, index: number) => {
    setAddingFood(index)
    try {
      await fetch('/api/foods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(food),
      })
      // Remove from online results and refresh local list
      setOnlineResults((prev) => prev.filter((_, i) => i !== index))
      fetchFoods(query, activeCategory)
    } finally {
      setAddingFood(null)
    }
  }

  const noLocalResults = !loading && foods.length === 0 && query.trim()

  return (
    <div className="max-w-md mx-auto px-4 pt-6">
      <h1 className="text-2xl font-bold text-text mb-5">Food Library 🍎</h1>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search foods..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border border-border rounded-xl pl-9 pr-4 py-3 text-text bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        <button
          onClick={() => setActiveCategory(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            activeCategory === null ? 'bg-primary text-white' : 'bg-card border border-border text-muted'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(activeCategory === c ? null : c)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              activeCategory === c ? 'bg-primary text-white' : 'bg-card border border-border text-muted'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-muted py-12">Loading…</div>
      ) : (
        <div className="space-y-2 pb-28">
          {/* Local results */}
          {foods.map((food) => (
            <div
              key={(food as FoodItem & { id: number }).id}
              className="bg-card rounded-2xl border border-border shadow-sm px-4 py-3 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-text truncate">{food.name}</p>
                  {food.category && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${CATEGORY_COLORS[food.category] ?? 'bg-gray-100 text-gray-500'}`}>
                      {food.category}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {food.servingAmount} {food.servingUnit} · {food.kcalPerServing} kcal
                </p>
              </div>
              <div className="flex items-center gap-1 ml-3">
                <button
                  onClick={() => setEditFood(food as FoodItem & { id: number })}
                  className="p-2 rounded-xl hover:bg-bg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <Pencil size={15} className="text-muted" />
                </button>
                <button
                  onClick={() => handleDelete((food as FoodItem & { id: number }).id!)}
                  className="p-2 rounded-xl hover:bg-danger/10 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <Trash2 size={15} className="text-danger" />
                </button>
              </div>
            </div>
          ))}

          {/* No local results → search online */}
          {noLocalResults && !showOnline && (
            <div className="text-center py-8">
              <p className="text-muted text-sm mb-4">No results in your library</p>
              <button
                onClick={searchOnline}
                className="flex items-center gap-2 mx-auto text-primary text-sm font-medium bg-primary/10 px-4 py-2.5 rounded-xl min-h-[44px]"
              >
                <Globe size={16} />
                Search online &amp; add to library
              </button>
            </div>
          )}

          {searchingOnline && (
            <p className="text-xs text-muted text-center py-6">🔍 Looking up with AI…</p>
          )}

          {/* Online results */}
          {showOnline && !searchingOnline && onlineResults.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted font-medium mb-2 px-1">Online results — tap to add to library</p>
              {onlineResults.map((food, i) => (
                <div
                  key={i}
                  className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 flex items-center justify-between mb-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text truncate">{food.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {food.servingAmount} {food.servingUnit} · {food.kcalPerServing} kcal
                    </p>
                  </div>
                  <button
                    onClick={() => addOnlineFood(food, i)}
                    disabled={addingFood === i}
                    className="ml-3 text-xs bg-primary text-white px-3 py-1.5 rounded-xl font-medium disabled:opacity-50 flex-shrink-0"
                  >
                    {addingFood === i ? '…' : '+ Add'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {showOnline && !searchingOnline && onlineResults.length === 0 && (
            <p className="text-xs text-muted text-center py-4">No online results found</p>
          )}

          {/* Empty state (no search) */}
          {!query.trim() && foods.length === 0 && (
            <div className="text-center text-muted py-12">
              <p className="text-lg mb-2">No foods yet</p>
              <p className="text-sm">Add your first food item below.</p>
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setAddSheet(true)}
        className="fixed right-4 bg-primary text-white rounded-full p-4 shadow-lg active:scale-95 transition-transform z-40 min-h-[56px] min-w-[56px] flex items-center justify-center"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom) + 1rem)' }}
      >
        <Plus size={24} />
      </button>

      {(addSheet || editFood) && (
        <AddFoodSheet
          food={editFood ?? undefined}
          onClose={() => {
            setAddSheet(false)
            setEditFood(null)
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
