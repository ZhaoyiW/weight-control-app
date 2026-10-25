// ── iPhone Duo / regular iPhone layout detection ──────────────────
//
// Single source of truth for telling apart: a normal iPhone, the Duo's
// outer display, and the Duo's inner display — used by DuoLayoutProvider
// (components/DuoLayoutProvider.tsx) so every page/component reads the
// same values via useDuoLayout() instead of re-deriving this logic.
//
// Measured on a Duo (CSS px):
//   outer portrait   Safari 382×590   home screen 382×660
//   inner landscape  Safari 951×538   home screen 867×651
// On both displays the status bar is a column on the right (~84px). In
// Safari the outer display also puts its toolbar in that column, so the
// width stays 382 either way. screen.width/height aren't usable: Safari
// reported the outer screen's 466×678 while on the inner display.
//
// - Outer portrait: no iPhone is 379–386 wide (SE/mini 375, others ≥390),
//   so match that width. With viewport-fit=cover the status column can
//   become part of the viewport (~466 wide), hence the second, squat-aspect
//   range; normal iPhones in portrait are ≤0.6.
// - In landscape, normal iPhones are wider than 2:1; the Duo's displays aren't.
// - pointer: coarse keeps resized desktop windows out.
//
// The same queries are registered as Tailwind variants (duo-rail etc.) in
// app/globals.css, which drive the nav position in CSS with no flash before
// hydration. Keep the two in sync.
//
// A Duo inner-display pane in Split View multitasking (~385pt wide) is
// indistinguishable from the outer display by viewport alone. This is
// intentional: both get the same side-nav/compact treatment (per Apple's
// HIG, each Split View pane places its controls on its own outer edge).

const touch = '(pointer: coarse)'

export const DUO_QUERIES = {
  outerPortrait: [
    `${touch} and (orientation: portrait) and (min-width: 379px) and (max-width: 386px)`,
    `${touch} and (orientation: portrait) and (min-width: 450px) and (max-width: 520px) and (min-aspect-ratio: 3/5)`,
  ].join(', '),
  outerLandscape: `${touch} and (orientation: landscape) and (max-width: 799px) and (max-aspect-ratio: 2/1)`,
  innerPortrait: `${touch} and (orientation: portrait) and (min-width: 560px) and (max-width: 760px)`,
  innerLandscape: `${touch} and (orientation: landscape) and (min-width: 800px) and (max-width: 1100px) and (max-aspect-ratio: 2/1)`,
} as const

export type DuoQueryKey = keyof typeof DUO_QUERIES

export type NavPosition = 'bottom' | 'side'
export type LayoutWidth = 'compact' | 'regular'
export type DuoScreen = 'outer' | 'inner' | null
export type DuoBucket = 'phone' | 'outer-portrait' | 'outer-landscape' | 'inner-portrait' | 'inner-landscape'

export interface DuoLayoutState {
  isDuo: boolean
  screen: DuoScreen
  navPosition: NavPosition
  layoutWidth: LayoutWidth
  /**
   * True for buckets with materially less vertical room than a regular
   * iPhone (outer portrait ~590–660, outer landscape, inner landscape
   * ~540–650). inner-portrait is NOT short despite being "regular" width,
   * so this is deliberately independent of layoutWidth.
   */
  isCompactHeight: boolean
  /** Debug-only: which bucket matched. Not part of the stable contract — don't branch app logic on this. */
  bucket: DuoBucket
}

export const DEFAULT_DUO_LAYOUT_STATE: DuoLayoutState = {
  isDuo: false,
  screen: null,
  navPosition: 'bottom',
  layoutWidth: 'compact',
  isCompactHeight: false,
  bucket: 'phone',
}

/**
 * Pure derivation from already-evaluated matchMedia results, so the actual
 * bucketing rules have one testable home independent of React/DOM listening.
 */
export function deriveDuoLayoutState(matches: Record<DuoQueryKey, boolean>): DuoLayoutState {
  if (matches.outerPortrait) {
    return { isDuo: true, screen: 'outer', navPosition: 'side', layoutWidth: 'compact', isCompactHeight: true, bucket: 'outer-portrait' }
  }
  if (matches.outerLandscape) {
    return { isDuo: true, screen: 'outer', navPosition: 'side', layoutWidth: 'compact', isCompactHeight: true, bucket: 'outer-landscape' }
  }
  if (matches.innerPortrait) {
    // Apple HIG exception: inner display in portrait keeps the standard
    // horizontal bar instead of moving controls to the side.
    return { isDuo: true, screen: 'inner', navPosition: 'bottom', layoutWidth: 'regular', isCompactHeight: false, bucket: 'inner-portrait' }
  }
  if (matches.innerLandscape) {
    return { isDuo: true, screen: 'inner', navPosition: 'side', layoutWidth: 'regular', isCompactHeight: true, bucket: 'inner-landscape' }
  }
  return DEFAULT_DUO_LAYOUT_STATE
}
