'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  DUO_QUERIES, DEFAULT_DUO_LAYOUT_STATE, deriveDuoLayoutState,
  type DuoLayoutState, type DuoQueryKey,
} from '@/lib/duoLayout'

const DuoLayoutContext = createContext<DuoLayoutState>(DEFAULT_DUO_LAYOUT_STATE)

/** Read the current Duo layout mode (for in-page sizing; nav position is CSS-driven). Values settle after mount (window/matchMedia are client-only). */
export function useDuoLayout(): DuoLayoutState {
  return useContext(DuoLayoutContext)
}

const QUERY_KEYS = Object.keys(DUO_QUERIES) as DuoQueryKey[]

export default function DuoLayoutProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DuoLayoutState>(DEFAULT_DUO_LAYOUT_STATE)

  useEffect(() => {
    const mqls = QUERY_KEYS.map((key) => window.matchMedia(DUO_QUERIES[key]))

    const recompute = () => {
      const matches = {} as Record<DuoQueryKey, boolean>
      QUERY_KEYS.forEach((key, i) => { matches[key] = mqls[i].matches })
      setState(deriveDuoLayoutState(matches))
    }

    recompute()
    mqls.forEach((mql) => mql.addEventListener('change', recompute))
    return () => mqls.forEach((mql) => mql.removeEventListener('change', recompute))
  }, [])

  return (
    <DuoLayoutContext.Provider value={state}>
      {children}
    </DuoLayoutContext.Provider>
  )
}
