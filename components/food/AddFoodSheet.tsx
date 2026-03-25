'use client'

import { useState } from 'react'
import { X, Check } from 'lucide-react'

interface FoodItem {
  id?: number
  name: string
  category?: string | null
  servingUnit: string
  servingAmount: number
  kcalPerServing: number
}

interface AddFoodSheetProps {
  food?: FoodItem
  onClose: () => void
  onSaved: () => void
}

const SERVING_UNITS = ['piece', 'g', 'ml', 'bowl', 'serving', 'tbsp', 'cup', '个', '克', '毫升', '碗', '勺']
const CATEGORIES = ['Carbs', 'Protein', 'Fat', 'Vegetables', 'Fruits', 'Dairy', 'Drinks', 'Snacks', 'Processed', 'Condiments', 'Other']

export default function AddFoodSheet({ food, onClose, onSaved }: AddFoodSheetProps) {
  const [name, setName] = useState(food?.name ?? '')
  const [category, setCategory] = useState(food?.category ?? '')
  const [servingUnit, setServingUnit] = useState(food?.servingUnit ?? 'piece')
  const [servingAmount, setServingAmount] = useState(food?.servingAmount?.toString() ?? '1')
  const [kcalPerServing, setKcalPerServing] = useState(food?.kcalPerServing?.toString() ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!servingAmount || isNaN(Number(servingAmount)) || Number(servingAmount) <= 0)
      errs.servingAmount = 'Enter a valid amount'
    if (!kcalPerServing || isNaN(Number(kcalPerServing)) || Number(kcalPerServing) < 0)
      errs.kcalPerServing = 'Enter valid calories'
    return errs
  }

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        category: category || null,
        servingUnit,
        servingAmount: Number(servingAmount),
        kcalPerServing: Number(kcalPerServing),
      }

      if (food?.id) {
        await fetch(`/api/foods/${food.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/foods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      onSaved()
    } catch {
      // handle silently
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-x-0 top-0 h-dvh z-[200] flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85dvh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-text">
            {food?.id ? 'Edit Food' : 'Add Food'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-bg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} className="text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Food Name</label>
            <input
              type="text"
              placeholder="e.g. Chicken Breast"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setErrors((e2) => ({ ...e2, name: '' }))
              }}
              className="w-full border border-border rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40"
              autoFocus
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(category === c ? '' : c)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    category === c
                      ? 'bg-primary text-white'
                      : 'bg-bg border border-border text-muted hover:border-primary/50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Serving unit */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Serving Unit</label>
            <select
              value={servingUnit}
              onChange={(e) => setServingUnit(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40"
            >
              {SERVING_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Serving amount + kcal row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Amount per serving
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="1"
                value={servingAmount}
                onChange={(e) => {
                  setServingAmount(e.target.value)
                  setErrors((e2) => ({ ...e2, servingAmount: '' }))
                }}
                className="w-full border border-border rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40"
              />
              {errors.servingAmount && (
                <p className="text-xs text-danger mt-1">{errors.servingAmount}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Kcal per serving</label>
              <input
                type="number"
                inputMode="decimal"
                step="1"
                placeholder="0"
                value={kcalPerServing}
                onChange={(e) => {
                  setKcalPerServing(e.target.value)
                  setErrors((e2) => ({ ...e2, kcalPerServing: '' }))
                }}
                className="w-full border border-border rounded-xl px-4 py-3 text-text bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40"
              />
              {errors.kcalPerServing && (
                <p className="text-xs text-danger mt-1">{errors.kcalPerServing}</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-primary text-white rounded-xl px-4 py-3 font-medium flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
          >
            <Check size={18} />
            {submitting ? 'Saving…' : food?.id ? 'Update Food' : 'Add Food'}
          </button>
        </div>
      </div>
    </div>
  )
}
