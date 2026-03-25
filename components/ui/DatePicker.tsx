'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface DatePickerProps {
  value: string       // YYYY-MM-DD
  max?: string        // YYYY-MM-DD, defaults to today
  onChange: (date: string) => void
  onClose: () => void
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function todayStr(): string {
  const d = new Date()
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
}

export default function DatePicker({ value, max, onChange, onClose }: DatePickerProps) {
  const parsed = new Date(value + 'T00:00:00')
  const [viewYear, setViewYear] = useState(parsed.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed.getMonth())

  const maxStr = max ?? todayStr()

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const canGoNext = toDateStr(viewYear, viewMonth + 1 > 11 ? 0 : viewMonth + 1, 1) <= maxStr ||
    (viewMonth === 11 ? toDateStr(viewYear + 1, 0, 1) <= maxStr : false)

  const handleDay = (day: number) => {
    const dateStr = toDateStr(viewYear, viewMonth, day)
    if (dateStr > maxStr) return
    onChange(dateStr)
    onClose()
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="fixed inset-x-0 top-0 h-dvh z-[200] flex items-start justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card rounded-b-3xl shadow-2xl p-5 pb-8">

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl hover:bg-bg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <ChevronLeft size={20} className="text-muted" />
          </button>
          <span className="font-semibold text-text text-base">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            disabled={!canGoNext}
            className="p-2 rounded-xl hover:bg-bg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center disabled:opacity-30"
          >
            <ChevronRight size={20} className="text-muted" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs text-muted font-medium py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />
            const dateStr = toDateStr(viewYear, viewMonth, day)
            const isSelected = dateStr === value
            const isToday = dateStr === todayStr()
            const isDisabled = dateStr > maxStr
            return (
              <button
                key={day}
                onClick={() => handleDay(day)}
                disabled={isDisabled}
                className={`
                  h-10 w-full rounded-xl text-sm font-medium transition-colors
                  ${isSelected
                    ? 'bg-primary text-white'
                    : isToday
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-text hover:bg-bg'}
                  ${isDisabled ? 'opacity-25 cursor-not-allowed' : ''}
                `}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
