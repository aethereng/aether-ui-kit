// Gantt layout math — generic, framework-free, no date dependencies.
// Operates on DAY-INDICES (numbers), not dates: the caller maps dates→index via its own
// domain helpers. Extracted from a working timeline surface's chart code; the only
// change on the way out was generics:
// day-indices instead of date strings, and TYPES/lane-meta passed in rather than imported.

export const SPINE_H = 92
export const LANE_ROW = 34
export const LANE_PAD = 10
export const LANE_MIN = 54
export const DENS_H = 36

// pixels-per-day; recomputed from the scroll container width (computePPD, source 755-760)
export function computePPD(view: string, scrollWidth: number, ndays: number): number {
  if (view === 'all') return Math.max(11, Math.floor((scrollWidth - 4) / ndays))
  return Math.max(26, Math.floor((scrollWidth - 4) / 33))
}

export interface GanttItem {
  id: string
  start: number // day index (inclusive)
  end?: number | null // day index (inclusive); null/undefined = point (one-day)
  type: string
  anchor?: boolean
  status?: string
  title: string
}

export interface GanttLane {
  type: string
  name: string
  color: string // lane accent (text/border/marker)
  wash: string // span background wash
}

export interface LaneLayout {
  type: string
  meta: GanttLane
  empty: boolean
  height: number
  spans: GanttItem[]
  points: GanttItem[]
  byDay: Record<number, GanttItem[]>
  expanded: GanttItem[] | null
  rows: number[] // highest occupied end-day per row (greedy stacking)
  /** Stacking row per span id. Returned as data rather than stamped onto the caller's
   *  objects: this function must not mutate its input. A consumer may hand us a deep
   *  reactive array (the gallery does), and writing to it from inside the computed that
   *  reads it is a write-during-read — currently idempotent, but it stops being so the
   *  moment a drag changes rows mid-gesture. */
  rowOf: Record<string, number>
}

// A POINT is a zero-duration, non-anchor item. Anchors keep the spine; spans keep their bars.
export function isPoint(it: GanttItem): boolean {
  return !it.anchor && (it.end == null || it.end === it.start)
}

// Per-type lane layout. Mirrors laneLayout() (source 798-834). `expandDay` toggles a day's
// one-day items into a vertical stack (source 967-976).
export function laneLayout(
  lanesMeta: GanttLane[],
  visible: GanttItem[],
  expandDay: { t: string; i: number } | null,
): Record<string, LaneLayout> {
  const lanes: Record<string, LaneLayout> = {}
  for (const m of lanesMeta) {
    lanes[m.type] = {
      type: m.type,
      meta: m,
      empty: true,
      height: 0,
      spans: [],
      points: [],
      byDay: {},
      expanded: null,
      rows: [],
      rowOf: {},
    }
  }
  for (const t of Object.keys(lanes)) {
    const L = lanes[t]!
    const mine = visible.filter((ev) => !ev.anchor && (ev.type || 'ops') === t)
    L.spans = mine.filter((ev) => !isPoint(ev))
    L.points = mine.filter(isPoint)
    L.spans.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title))
    for (const ev of L.spans) {
      const s = ev.start
      const e = ev.end != null ? ev.end : s
      let row = 0
      while (row < L.rows.length && (L.rows[row] ?? -1) >= s) row++
      if (row === L.rows.length) L.rows.push(-1)
      L.rows[row] = Math.max(L.rows[row] ?? -1, e)
      L.rowOf[ev.id] = row
    }
    L.byDay = {}
    for (const ev of L.points) {
      const i = ev.start
      ;(L.byDay[i] = L.byDay[i] ?? []).push(ev)
    }
    L.expanded =
      expandDay && expandDay.t === t && L.byDay[expandDay.i] ? (L.byDay[expandDay.i] ?? null) : null
    L.empty = mine.length === 0
    L.height = L.empty
      ? 0
      : Math.max(LANE_MIN, L.rows.length * LANE_ROW + LANE_PAD * 2) +
        (L.points.length ? DENS_H : 0) +
        (L.expanded ? L.expanded.length * LANE_ROW + 6 : 0)
  }
  return lanes
}

// Total pixel height of all lanes (plus spine) — used to size the inner container.
export function lanesHeight(lanes: Record<string, LaneLayout>): number {
  let h = 0
  for (const t of Object.keys(lanes)) {
    const L = lanes[t]!
    if (!L.empty) h += L.height
  }
  return h
}

// Vertical geometry for a lane's density row (mirrors source 946-977).
export function densGeom(L: LaneLayout): { dy: number; base: number } {
  const dy = Math.max(LANE_MIN, L.rows.length * LANE_ROW + LANE_PAD * 2) - LANE_PAD
  const base = dy + DENS_H - 7
  return { dy, base }
}
