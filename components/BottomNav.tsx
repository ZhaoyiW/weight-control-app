'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, UtensilsCrossed, Apple, User, BarChart3 } from 'lucide-react'

export const TAB_VISIT_EVENT = 'app:tab'

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/meals', label: 'Meals', icon: UtensilsCrossed },
  { href: '/summary', label: 'Summary', icon: BarChart3 },
  { href: '/profile', label: 'Health', icon: User },
  { href: '/food', label: 'Food', icon: Apple },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-md mx-auto flex items-stretch">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => window.dispatchEvent(new CustomEvent(TAB_VISIT_EVENT, { detail: href }))}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 transition-colors"
            >
              <Icon
                size={22}
                className={isActive ? 'text-primary' : 'text-muted'}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span
                className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted'}`}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
