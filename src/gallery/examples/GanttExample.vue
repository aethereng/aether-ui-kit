<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Gantt from '@aether/ui-kit/viz/gantt'
import { computePPD } from '@aether/ui-kit/viz/core/gantt'
import type { GanttItem, GanttLane } from '@aether/ui-kit/viz/core/gantt'

const items = ref<GanttItem[]>([
  { id: 'a1', start: 2, end: 9, type: 'prepare', status: 'done', title: 'Protocol' },
  { id: 'a2', start: 10, end: 20, type: 'prepare', status: 'open', title: 'Calibration' },
  // several one-day items, some sharing a date: this is what the density row exists for
  { id: 'b1', start: 12, type: 'run', status: 'open', title: 'Batch A' },
  { id: 'b3', start: 12, type: 'run', status: 'done', title: 'Batch B' },
  { id: 'b4', start: 12, type: 'run', status: 'open', title: 'Blank' },
  { id: 'b5', start: 34, type: 'run', status: 'open', title: 'Repeat A' },
  { id: 'b2', start: 21, end: 30, type: 'run', status: 'open', title: 'Long soak' },
  { id: 'c1', start: 31, end: 45, type: 'analyse', status: 'open', title: 'Curve fitting' },
  { id: 'x1', start: 0, type: 'prepare', anchor: true, status: 'done', title: 'Day-0 kickoff' },
  { id: 'x2', start: 24, type: 'analyse', anchor: true, status: 'open', title: 'Interim review' },
])

/* THREE HUES, each a token, and the washes DERIVED from them with color-mix rather than written as
   literal rgba. The two literals here before could not follow a theme: a wash mixed for a paper
   ground stays that colour on a dark one, where it wants to be lighter than its surface rather
   than darker. Mixing against `transparent` keeps a wash at a fixed alpha of whatever the hue
   currently is, so both themes get it right from one line. */
const wash = (token: string) => `color-mix(in srgb, var(${token}) 18%, transparent)`
const lanes: GanttLane[] = [
  { type: 'prepare', name: 'Prepare', color: 'var(--aether-cool-soft)', wash: wash('--aether-cool') },
  { type: 'run', name: 'Run', color: 'var(--aether-warm)', wash: wash('--aether-warm') },
  { type: 'analyse', name: 'Analyse', color: 'var(--aether-rose)', wash: wash('--aether-rose') },
]

const DAYS = 60
/* A fixed day index, not a real date: the component works in day indices, and a demo whose marker
   wanders with the calendar is a demo nobody can screenshot. */
const TODAY = 18

/* Week furniture is the CALLER's: the component knows only day indices, which is what keeps Gantt
   usable on a schedule that is not a calendar at all. Day 0 is treated as a Monday here. */
const weekends = Array.from({ length: DAYS }, (_, i) => i).filter((i) => i % 7 === 5)
const weekdays = Array.from({ length: DAYS }, (_, i) => i).filter((i) => i > 0 && i % 7 === 0)
const weekLabels = weekdays.map((d) => ({ day: d, label: 'W' + (d / 7 + 1) }))

/* Period boundaries, deliberately NOT month names: Gantt never touches dates, so a demo naming
   real months would contradict the component it documents. */
const markers = [
  { day: 0, label: 'Month 1' },
  { day: 31, label: 'Month 2' },
]

const selection = ref<string | null>(null)
const expanded = ref('—')

/* Zoom to fit. Pinned at 26px/day, 60 days always came to 1560px and always scrolled, even on a
   wide desktop with room to spare. computePPD divides the width we actually have by the days we
   actually show, with a floor so a narrow screen gets a legible chart behind a scroller rather
   than an illegible one that fits. */
const host = ref<HTMLElement | null>(null)
const ppd = ref(26)
let ro: ResizeObserver | null = null

function measure() {
  /* Measure the SCROLLER, not the host: the chart also renders a lane-label gutter, so the days
     get roughly 130px less than the section is wide. clientWidth here is unaffected by ppd (only
     scrollWidth is), so this cannot feed back into itself. */
  const el = host.value
  if (!el) return
  const scroller = el.querySelector('.ag-scroll') as HTMLElement | null
  const w = scroller?.clientWidth || el.clientWidth
  if (w > 0) ppd.value = computePPD('all', w, DAYS)
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(measure)
    if (host.value) ro.observe(host.value)
    requestAnimationFrame(measure) // again once the chart has laid out and the scroller exists
  }
})
onBeforeUnmount(() => ro?.disconnect())

function onMove(id: string, start: number, end: number | null) {
  const it = items.value.find((x) => x.id === id)
  if (!it) return
  it.start = start
  it.end = end
}
function onResize(id: string, edge: 'l' | 'r', value: number) {
  const it = items.value.find((x) => x.id === id)
  if (!it) return
  if (edge === 'l') it.start = value
  else it.end = value
}
function onNewAt(day: number, type: string) {
  items.value.push({ id: 'n' + day + type, start: day, type, status: 'open', title: 'New ' + type })
}
/* expandDay emits an OBJECT — { t, i } — not a day number. */
function onExpandDay(day: { t: string; i: number } | null) {
  expanded.value = day ? day.t + ' day ' + day.i : '—'
}
</script>

<template>
  <p class="g-hint">
    Drag a bar to move it, its edges to resize. Double-click empty lane space to create. Undo
    checkpoints come from drag-start / drag-end, not every pixel. The strip under each lane is the
    one-day row — three items share day 12, so they are stacked into one block rather than
    overlapping. Click it to expand them.
  </p>

  <div :ref="(el) => (host = el as HTMLElement | null)" class="g-fill">
    <Gantt
      :items="items"
      :lanes="lanes"
      :ppd="ppd"
      :ndays="DAYS"
      :current-day="TODAY"
      :weekends="weekends"
      :weekdays="weekdays"
      :week-labels="weekLabels"
      :selection="selection"
      :markers="markers"
      @select="selection = $event"
      @move="onMove"
      @resize="onResize"
      @new-at="onNewAt"
      @expand-day="onExpandDay"
    />
  </div>

  <code class="g-ex-state">
    selected = {{ selection || '∅' }} · expanded = {{ expanded }} · zoom = {{ ppd }}px/day · items =
    {{ items.length }}
  </code>
</template>
