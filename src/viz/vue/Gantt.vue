<script setup lang="ts">
/* Thin Vue wrapper over viz/core/gantt. Controlled (like Graph2D/Transport): the caller owns
 * the data; Gantt renders and emits deltas in DAY-INDEX space. The caller maps
 * day-indices ↔ its own dates, which is what keeps it usable outside a calendar.
 * A future GanttGL.vue reuses the same core and only swaps the draw call. */
import { computed, ref } from 'vue'
import {
  SPINE_H,
  LANE_ROW,
  LANE_PAD,
  LANE_MIN,
  DENS_H,
  laneLayout,
  lanesHeight,
  densGeom,
  type GanttItem,
  type GanttLane,
} from '../core/gantt'

const props = withDefaults(
  defineProps<{
    items: GanttItem[]
    lanes: GanttLane[]
    ppd: number
    ndays: number
    currentDay?: number | null
    selection?: string | null
    markers?: { day: number; label: string }[] // month lines + labels
    weekends?: number[] // day indices that are weekend columns
    weekdays?: number[] // day indices that are week separators
    /** Small labels down the spine, one per week separator. The reference chart fills the
     *  middle of the anchor band with these; without them the band reads as empty space.
     *  Labels are caller-supplied because the component works in day indices, not dates. */
    weekLabels?: { day: number; label: string }[]
  }>(),
  {
    currentDay: null,
    selection: null,
    markers: () => [],
    weekends: () => [],
    weekdays: () => [],
    weekLabels: () => [],
  },
)

interface GanttEmit {
  select: [id: string]
  /** Fired once, when a gesture crosses the movement threshold — BEFORE the first move/resize.
   *  A caller that supports undo checkpoints here; without it, a drag emits a stream of
   *  mutations with no boundary and undo has nothing coherent to restore. */
  dragStart: [id: string]
  move: [id: string, start: number, end: number | null]
  resize: [id: string, edge: 'l' | 'r', value: number]
  /** Fired once when a real (moved) gesture ends. Callers persist here rather than on every
   *  pointermove. Not fired for a click that never moved — that emits `select` instead. */
  dragEnd: [id: string]
  newAt: [day: number, type: string]
  expandDay: [day: { t: string; i: number } | null]
}
const emit = defineEmits<GanttEmit>()

const expandDay = ref<{ t: string; i: number } | null>(null)
const tI = computed(() => props.currentDay)
const W = computed(() => props.ndays * props.ppd)
const lanes = computed(() => laneLayout(props.lanes, props.items, expandDay.value))

// lane vertical positions
const laneBoxes = computed(() => {
  const out: {
    t: string
    top: number
    height: number
    L: ReturnType<typeof laneLayout>[string]
  }[] = []
  let y = SPINE_H
  for (const m of props.lanes) {
    const L = lanes.value[m.type]!
    if (L.empty) continue
    out.push({ t: m.type, top: y, height: L.height, L })
    y += L.height
  }
  return out
})

// ── interactions ──────────────────────────────────────────────────────────────
interface Drag {
  id: string
  mode: 'move' | 'l' | 'r'
  x0: number
  s0: number
  e0: number | null
  moved: boolean
}
let drag: Drag | null = null

function onPointerDown(e: PointerEvent) {
  const tgt = e.target as HTMLElement
  const dday = tgt.closest('.ag-dday') as HTMLElement | null
  if (dday) {
    const t = dday.dataset.lane!,
      i = +dday.dataset.day!
    const lane = lanes.value[t]
    const one = lane ? (lane.byDay[i] ?? []) : []
    if (one.length === 1) emit('select', one[0]?.id ?? '')
    else {
      const cur = expandDay.value
      const same = cur != null && cur.t === t && cur.i === i
      expandDay.value = same ? null : { t, i }
      emit('expandDay', expandDay.value)
    }
    e.stopPropagation()
    return
  }
  // anchors: select on click, never drag (regression fix, source 1162)
  const anc = tgt.closest('.ag-canchor') as HTMLElement | null
  if (anc) {
    emit('select', anc.dataset.id!)
    e.stopPropagation()
    return
  }
  const el = tgt.closest('.ag-ev, .ag-ms') as HTMLElement | null
  if (!el) return
  const it = props.items.find((x) => x.id === el.dataset.id)
  if (!it) return
  const mode = tgt.classList.contains('h') ? (tgt.classList.contains('l') ? 'l' : 'r') : 'move'
  drag = {
    id: it.id,
    mode,
    x0: e.clientX,
    s0: it.start,
    e0: it.end != null ? it.end : null,
    moved: false,
  }
  ;(e.target as HTMLElement).setPointerCapture?.(
    (e as PointerEvent & { pointerId: number }).pointerId,
  )
  e.preventDefault()
}
function onPointerMove(e: PointerEvent) {
  const d = drag
  if (!d) return
  const dd = Math.round((e.clientX - d.x0) / props.ppd)
  // The threshold crossing is the gesture's real start — announce it once, before the first
  // mutation, so a caller can snapshot the pre-drag state.
  if (!d.moved && Math.abs(e.clientX - d.x0) > 4) {
    d.moved = true
    emit('dragStart', d.id)
  }
  if (!d.moved) return
  const it = props.items.find((x) => x.id === d.id)
  if (!it) return
  if (d.mode === 'move') {
    const len = d.e0 !== null ? d.e0 - d.s0 : 0
    const ns = Math.max(0, Math.min(d.s0 + dd, props.ndays - 1 - len))
    emit('move', d.id, ns, d.e0 !== null ? ns + len : null)
  } else if (d.mode === 'l') {
    const ns = Math.max(0, Math.min(d.s0 + dd, d.e0 !== null ? d.e0 : d.s0))
    emit('resize', d.id, 'l', ns)
  } else {
    const ne = Math.max(0, Math.max(d.e0! + dd, it.start))
    emit('resize', d.id, 'r', ne)
  }
}
function onPointerUp() {
  if (!drag) return
  const wasClick = !drag.moved,
    id = drag.id
  drag = null
  if (wasClick) emit('select', id)
  else emit('dragEnd', id)
}
function onDblClick(e: MouseEvent) {
  const lane = (e.target as HTMLElement).closest('.ag-lane') as HTMLElement | null
  if (!lane || (e.target as HTMLElement).closest('.ag-ev,.ag-ms')) return
  const rect = lane.getBoundingClientRect()
  const day = Math.max(
    0,
    Math.min(props.ndays - 1, Math.floor((e.clientX - rect.left) / props.ppd)),
  )
  const type = lane.dataset.type!
  emit('newAt', day, type)
}

/* An anchor takes its LANE's colour, exactly as the original does — the port coloured by
 * STATUS instead, so every open anchor came out rose and the lane encoding was lost. */
const anchors = computed(() =>
  props.items
    .filter((i) => i.anchor)
    .sort((a, b) => a.start - b.start)
    .map((a) => ({ ...a, laneColor: props.lanes.find((l) => l.type === a.type)?.color })),
)
</script>

<template>
  <div class="aether-gantt">
    <div class="ag-labels">
      <!-- the band is self-evident from the markers in it; the gutter only holds its height
           so the lane labels below stay aligned with their rows -->
      <div class="ag-spine-label" :style="{ height: SPINE_H + 'px' }"></div>
      <div
        v-for="b in laneBoxes"
        :key="'lbl' + b.t"
        class="ag-lane-label"
        :style="{ height: b.height + 'px' }"
      >
        <span class="nm" :style="{ color: b.L.meta.color }">{{ b.L.meta.name }}</span>
        <span class="ct"
          >{{ b.L.spans.length }} span{{ b.L.spans.length === 1 ? '' : 's'
          }}{{ b.L.points.length ? ' · ' + b.L.points.length + ' one-day' : '' }}</span
        >
      </div>
    </div>

    <div class="ag-scroll">
      <!-- A direct-manipulation surface: pointer drag pans, and a double-click on empty lane space
           emits `newAt`. It cannot become a button, and a keydown bound to a pan surface is not the
           keyboard path a user needs.
           The rule is pointing at something real all the same, and this comment is the record rather
           than a dismissal: `newAt` has NO keyboard equivalent, so a keyboard-only user cannot
           create an item by this route. Closing that means an affordance decision — a host-provided
           "add" control, or a focusable lane with its own key handling — which changes this
           component's API and is not a lint fix. Left open deliberately, not overlooked. -->
      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
      <div
        class="ag-inner"
        :style="{ width: W + 'px', height: SPINE_H + lanesHeight(lanes) + 'px' }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @dblclick="onDblClick"
      >
        <!-- grid furniture -->
        <div
          v-for="i in weekends"
          :key="'wknd' + i"
          class="ag-wknd"
          :style="{ left: i * ppd + 'px', width: 2 * ppd + 'px' }"
        />
        <div
          v-for="i in weekdays"
          :key="'wk' + i"
          class="ag-wk"
          :style="{ left: i * ppd + 'px' }"
        />
        <div
          v-for="m in markers"
          :key="'ml' + m.day"
          class="ag-mline"
          :style="{ left: m.day * ppd + 'px' }"
        />
        <div
          v-for="m in markers"
          :key="'mlab' + m.day"
          class="ag-mlabel"
          :style="{ left: m.day * ppd + 10 + 'px' }"
        >
          {{ m.label }}
        </div>
        <div
          v-if="tI != null && tI >= 0 && tI < ndays"
          class="ag-today"
          :style="{ left: (tI + 0.5) * ppd + 'px' }"
          data-txt="TODAY"
        />

        <!-- spine + anchors -->
        <div class="ag-spine" :style="{ width: W + 'px', height: SPINE_H + 'px' }">
          <div
            v-for="w in weekLabels"
            :key="'wk' + w.day"
            class="ag-wkno"
            :style="{ left: w.day * ppd + 3 + 'px' }"
          >
            {{ w.label }}
          </div>
          <div
            v-for="a in anchors"
            :key="a.id"
            class="ag-canchor"
            :class="{ sel: selection === a.id, open: a.status !== 'done' }"
            :data-id="a.id"
            :style="{
              left: (a.start + 0.5) * ppd + 'px',
              color: a.laneColor ?? 'var(--aether-ink-soft)',
            }"
          >
            <div class="stem" />
            <div class="dia" />
            <div class="atxt">
              <span class="t">{{ a.title }}</span><br />
              <span class="tm mono"
                >{{ a.end ? '–' + (a.end - a.start + 1) + 'd' : '' }} ·
                {{
                  a.status === 'done'
                    ? '✓ done'
                    : a.start - (tI ?? 0) > 0
                      ? 'T−' + (a.start - (tI ?? 0))
                      : a.start - (tI ?? 0) === 0
                        ? 'today'
                        : -(a.start - (tI ?? 0)) + 'd ago'
                }}</span
              >
            </div>
          </div>
        </div>

        <!-- lanes -->
        <template v-for="b in laneBoxes" :key="'lane' + b.t">
          <div
            class="ag-lane"
            :data-type="b.t"
            :style="{
              position: 'absolute',
              top: b.top + 'px',
              left: 0,
              width: W + 'px',
              height: b.height + 'px',
            }"
          >
            <!-- spans -->
            <template v-for="ev in b.L.spans" :key="ev.id">
              <div
                v-if="ev.end != null"
                class="ag-ev"
                :class="['st-' + (ev.status || 'open'), { sel: selection === ev.id }]"
                :data-id="ev.id"
                :style="{
                  left: ev.start * ppd + 1 + 'px',
                  top: LANE_PAD + (b.L.rowOf[ev.id] ?? 0) * LANE_ROW + 'px',
                  width: Math.max(ppd, (ev.end - ev.start + 1) * ppd - 3) + 'px',
                  background: b.L.meta.wash,
                  borderColor: b.L.meta.color,
                  color: b.L.meta.color,
                }"
                :title="ev.title"
              >
                <div class="h l" />
                <span>{{ ev.status === 'done' ? '✓ ' : '' }}{{ ev.title }}</span>
                <div class="h r" />
              </div>
              <div
                v-else
                class="ag-ms"
                :class="['st-' + (ev.status || 'open'), { sel: selection === ev.id }]"
                :data-id="ev.id"
                :style="{
                  left: (ev.start + 0.5) * ppd - 6.5 + 'px',
                  top: LANE_PAD + (b.L.rowOf[ev.id] ?? 0) * LANE_ROW + 5 + 'px',
                  background: b.L.meta.color,
                  borderColor: b.L.meta.color,
                }"
                :title="ev.title"
              />
              <div
                v-if="ev.end == null"
                class="ag-ms-label"
                :style="{
                  left: (ev.start + 0.5) * ppd + 11 + 'px',
                  top: LANE_PAD + (b.L.rowOf[ev.id] ?? 0) * LANE_ROW + 3 + 'px',
                  color: b.L.meta.color,
                }"
              >
                {{ ev.title }}
              </div>
            </template>

            <!-- density row -->
            <template v-if="b.L.points.length">
              <div class="ag-dens" :style="{ top: densGeom(b.L).dy + 'px', width: W + 'px' }" />
              <div
                v-for="(dayItems, key) in b.L.byDay"
                :key="'d' + key"
                class="ag-dday"
                :class="{
                  on: expandDay && expandDay.t === b.t && expandDay.i === +key,
                  sel: dayItems.some((x: GanttItem) => x.id === selection),
                }"
                :data-lane="b.t"
                :data-day="key"
                :style="{
                  left: (+key + 0.5) * ppd - Math.max(6, Math.min(ppd - 3, 13)) / 2 + 'px',
                  top:
                    densGeom(b.L).base -
                    Math.min(9 + (dayItems.length - 1) * 7, DENS_H - 12) +
                    'px',
                  width: Math.max(6, Math.min(ppd - 3, 13)) + 'px',
                  height: Math.min(9 + (dayItems.length - 1) * 7, DENS_H - 12) + 'px',
                  background: b.L.meta.color,
                }"
                :title="dayItems.length + ' one-day item' + (dayItems.length === 1 ? '' : 's')"
              />
              <template v-for="(dayItems, key) in b.L.byDay" :key="'dn' + key">
                <div
                  v-if="dayItems.length > 1"
                  class="ag-ddayn mono"
                  :style="{
                    left: (+key + 0.5) * ppd - Math.max(6, Math.min(ppd - 3, 13)) / 2 + 'px',
                    width: Math.max(6, Math.min(ppd - 3, 13)) + 'px',
                    top:
                      densGeom(b.L).base -
                      Math.min(9 + (dayItems.length - 1) * 7, DENS_H - 12) -
                      12 +
                      'px',
                    color: b.L.meta.color,
                  }"
                >
                  {{ dayItems.length }}
                </div>
              </template>

              <!-- expanded day -->
              <template v-if="b.L.expanded">
                <div
                  v-for="ev in b.L.expanded"
                  :key="'ex' + ev.id"
                  class="ag-ms"
                  :class="['st-' + (ev.status || 'open'), { sel: selection === ev.id }]"
                  :data-id="ev.id"
                  :style="{
                    left: (ev.start + 0.5) * ppd - 6.5 + 'px',
                    top:
                      Math.max(LANE_MIN, b.L.rows.length * LANE_ROW + LANE_PAD * 2) +
                      DENS_H +
                      5 +
                      'px',
                    background: b.L.meta.color,
                    borderColor: b.L.meta.color,
                  }"
                  :title="ev.title"
                />
              </template>
            </template>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aether-gantt {
  display: flex;
  height: 100%;
  background: var(--aether-surface);
  color: var(--aether-ink);
  font:
    13px ui-monospace,
    monospace;
}
.ag-labels {
  /* A fixed 132px was 34% of a 390px phone before the chart got a single pixel. Clamped
     instead: it gives ground on a narrow screen and is unchanged on a desktop, where 22vw
     is well past 132px. The lane name and its counts still fit at the low end. */
  width: clamp(88px, 22vw, 132px);
  flex: none;
  border-right: 1px solid var(--aether-line-strong);
  overflow: hidden;
}
.ag-spine-label {
  display: flex;
  align-items: flex-end;
  padding: 6px 10px;
  color: var(--aether-ink-soft);
  font-weight: 600;
  /* matches the band it labels, so the two read as one region across the gutter */
  background: var(--aether-panel);
  border-bottom: 1px solid var(--aether-line-strong);
}
.ag-lane-label {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 4px 10px;
  border-bottom: 1px solid var(--aether-line);
}
.ag-lane-label .nm {
  font-weight: 700;
}
.ag-lane-label .ct {
  color: var(--aether-ink-soft);
  font-size: 11px;
}
.ag-scroll {
  flex: 1;
  overflow: auto;
}
.ag-inner {
  position: relative;
}
.ag-wknd {
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--aether-line);
  opacity: 0.5;
}
.ag-wk {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px solid var(--aether-line);
}
.ag-mline {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 2px solid var(--aether-line-strong);
}
.ag-mlabel {
  position: absolute;
  top: 4px;
  font-weight: 700;
}
/* Ported from the reference: a solid warm hairline, not a dashed cool one. Today is the
   one thing on the chart the reader is orienting against -- it gets the accent colour and
   sits above the bars. */
.ag-today {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1.5px;
  background: var(--aether-warm);
  z-index: 3;
  pointer-events: none;
}
.ag-today::after {
  content: attr(data-txt);
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--aether-warm);
  font-family: var(--aether-font-mono);
}
/* Anchors are plan-level milestones that belong to no single lane, so they get their own
   band above the lanes. It is tinted rather than left transparent: with only a hairline
   under it, the band read as part of the first lane and the anchors looked misplaced. */
.ag-spine {
  position: absolute;
  top: 0;
  left: 0;
  background: var(--aether-panel);
  border-bottom: 1px solid var(--aether-line-strong);
}
/* Ported from the reference: the anchor hangs from the BOTTOM of the band -- a short
   hairline stem, the diamond above it, and the label above that. Children are absolutely
   placed against a zero-width anchor sitting on its day, so a long title can never shift the
   diamond off the date. Left-aligned rather than centred, which is also why an anchor on
   day 0 has never needed edge handling: its label runs rightwards into the chart. */
/* week numbers down the middle of the band, as the original has them */
.ag-wkno {
  position: absolute;
  top: 44px;
  font-size: 9px;
  color: var(--aether-faint);
  font-family: var(--aether-font-mono);
  pointer-events: none;
}
.ag-canchor {
  position: absolute;
  bottom: 0;
  height: 100%;
  cursor: pointer;
}
.ag-canchor .stem {
  position: absolute;
  left: -0.5px;
  bottom: 0;
  width: 1px;
  height: 14px;
  background: var(--aether-line-strong);
}
.ag-canchor .dia {
  position: absolute;
  left: -5px;
  bottom: 12px;
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  border: 1.5px solid currentColor;
  background: currentColor;
}
/* an open anchor reads hollow; a done one is filled */
.ag-canchor.open .dia {
  background: var(--aether-surface);
}
/* Label sits ABOVE the diamond and is left-aligned from the day, as the original has it.
   Absolute so the anchor stays zero-width on its date — a long title must never drag the
   diamond off the day it marks — and left-aligned is also why an anchor on day 0 needs no
   special edge handling: the text runs rightwards into the chart. */
.ag-canchor .atxt {
  position: absolute;
  bottom: 40px; /* clears the diamond's rotated box, which reaches ~30px */
  left: -4px;
  white-space: nowrap;
  font-size: 10.5px;
  line-height: 1.35;
  color: var(--aether-ink-soft);
}
.ag-canchor .atxt .t {
  font-weight: 700;
  color: currentColor;
  letter-spacing: 0.3px;
}
/* Its own line under the title, not trailing it. --aether-faint is too dim to read at 10px on
   a dark surface, and the date is information rather than chrome. */
.ag-canchor .atxt .tm {
  display: block;
  color: var(--aether-ink-soft);
  font-size: 10px;
  opacity: 0.85;
  font-weight: 400;
  letter-spacing: 0;
}
.ag-canchor:hover .atxt .t {
  text-decoration: underline;
}
.ag-canchor.sel .dia {
  outline: 2px solid var(--aether-cool);
  outline-offset: 1.5px;
}
.ag-lane {
  position: relative;
  border-bottom: 1px solid var(--aether-line);
}
.ag-lane:nth-child(even) {
  background: var(--aether-lane-alt);
}
/* Bars, ported from the reference. The status STATES matter as much as the geometry:
   the original tells planned / open / done / risk apart by border style and opacity, so a
   reader sees status without consulting a legend. The kit emitted the st-* classes but had
   no rules behind them, leaving every status identical apart from its lane colour. */
.ag-ev {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border: 1.5px solid;
  border-radius: 7px;
  font-size: 11.5px;
  font-weight: 550;
  cursor: grab;
  user-select: none;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  box-shadow: var(--aether-shadow);
  transition: box-shadow 0.1s;
}
.ag-ev span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.ag-ev:hover {
  box-shadow: var(--aether-shadow-hover);
  z-index: 2;
}
.ag-ev.dragging {
  cursor: grabbing;
  opacity: 0.85;
  z-index: 6;
}
.ag-ev.st-planned {
  border-style: dashed;
}
.ag-ev.st-open {
  border-style: dotted;
  background: transparent !important;
}
/* Done recedes, but its label stays readable.
 *
 * This was `opacity: 0.45` on the whole bar, which put the label at 2.1:1 on the dark theme and
 * 1.7 on the light one. Raising the value does not fix it and that was measured rather than
 * assumed: a group opacity blends the text AND the fill toward the same surface, and a bar's label
 * is the lane colour sitting on a wash of that same colour, so both sides move together — at 0.8,
 * still only 3.8 and 2.8. The lever was never the amount of dimming.
 *
 * So the veil dims the fill and border, and the label sits above it at full strength. The
 * line-through already says "done" on its own; the dimming is reinforcement, and reinforcement is
 * not worth an unreadable label. */
.ag-ev.st-done {
  position: relative;
}
.ag-ev.st-done::before {
  content: '';
  position: absolute;
  /* covers the 1.5px border too, so the outline recedes with the fill */
  inset: -1.5px;
  border-radius: 7px;
  background: var(--aether-surface);
  /* 0.8, because the ceiling here is the LANE COLOUR and not the veil: a label is its lane's hue
     and --aether-warm is only 4.8:1 against the bare surface, so the wash underneath has to be
     almost entirely covered before the label reaches the floor. 0.55 left it at 3.6 on the light
     theme; more veil buys very little after this. */
  opacity: 0.8;
  pointer-events: none;
}
.ag-ev.st-done span {
  /* above the veil — this is the whole point of the change */
  position: relative;
  z-index: 1;
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}
.ag-ev.st-risk {
  box-shadow:
    inset 3.5px 0 0 var(--aether-warm-soft),
    var(--aether-shadow);
}
.ag-ev.sel {
  outline: 2px solid var(--aether-cool);
}
.ag-ev .h {
  width: 6px;
  align-self: stretch;
  cursor: ew-resize;
}
.ag-ms {
  position: absolute;
  width: 13px;
  height: 13px;
  /* a rotated square, matching the anchor diamond -- the kit had drawn a circle */
  transform: rotate(45deg);
  border: 1.5px solid;
  box-shadow: var(--aether-shadow);
  cursor: grab;
}
.ag-ms.st-open {
  background: var(--aether-surface) !important;
}
.ag-ms.sel {
  outline: 2px solid var(--aether-cool);
}
.ag-ms-label {
  position: absolute;
  white-space: nowrap;
  font-size: 11px;
}
.ag-dens {
  position: absolute;
  left: 0;
  height: 2px;
  background: var(--aether-line-strong);
}
.ag-dday {
  position: absolute;
  border-radius: 2px;
  opacity: 0.8;
}
.ag-dday.on {
  outline: 2px solid var(--aether-cool);
}
.ag-ddayn {
  position: absolute;
  font-size: 10px;
  text-align: center;
}
</style>
