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

  const items = (itemCls: string) => tabs.map(({ href, label, icon: Icon }) => {
    const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return (
      <Link
        key={href}
        href={href}
        onClick={() => window.dispatchEvent(new CustomEvent(TAB_VISIT_EVENT, { detail: href }))}
        className={`${itemCls} flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 transition-colors`}
      >
        <Icon
          size={22}
          className={isActive ? 'text-primary' : 'text-muted'}
          strokeWidth={isActive ? 2.5 : 1.8}
        />
        <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted'}`}>
          {label}
        </span>
      </Link>
    )
  })

  // Both navs render; CSS picks one (duo-rail variant in globals.css), so the
  // right one shows on first paint with no switch after hydration.
  return (
    <>
      <nav
        className="duo-rail:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-md mx-auto flex items-stretch">
          {items('flex-1')}
        </div>
      </nav>

      {/* Outer display / inner display in landscape: Apple moves controls to
          the trailing edge to preserve vertical space. A floating pill at the
          bottom right, in the Duo's status-bar column, within thumb reach. */}
      <nav className="hidden duo-rail:flex side-nav-pos fixed z-40 w-14 py-2 flex-col items-stretch rounded-full bg-card/75 backdrop-blur-md border border-border/60 shadow-lg overflow-hidden">
        {items('w-full')}
      </nav>
    </>
  )
}
