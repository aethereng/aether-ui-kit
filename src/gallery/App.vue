<script setup lang="ts">
/* @aether/ui-kit gallery.
 *
 * This page is also the kit's own proof: it is a HOST APP. It defines the --aether-* tokens
 * itself (light + dark below) and the kit's components follow, which is exactly the contract
 * a consumer gets. The theme switch at the top is not a mock — it re-themes this page, and the
 * components re-theme with it because they never hardcode a colour. */
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import GSection from './GSection.vue'
import { COMPONENTS, GROUPS, byGroup, type Group } from './meta'

import Seg from '@/controls/vue/Seg.vue'
import Chip from '@/controls/vue/Chip.vue'
import Tool from '@/controls/vue/Tool.vue'
import FilterRail from '@/controls/vue/FilterRail.vue'
import SearchField from '@/controls/vue/SearchField.vue'
import Transport from '@/controls/vue/Transport.vue'
import ChatPanel from '@/controls/vue/ChatPanel.vue'
import PropertyEditor from '@/property-editor/vue/PropertyEditor.vue'
import Graph2D from '@/viz/vue/Graph2D.vue'
import Gantt from '@/viz/vue/Gantt.vue'

import { ForceLayout } from '@/viz/core'
import { computePPD } from '@/viz/core/gantt'
import type { GNode, GEdge } from '@/viz/core'
import type { GanttItem, GanttLane } from '@/viz/core/gantt'
import type { ChatMessage } from '@/controls/core'
import type { SegOption, ChipOption, FilterGroup } from '@/controls/core/types'
import type { FieldDescriptor, FieldValues as PEValues } from '@/property-editor/core/types'

/* ── page theme — the kit's token contract, demonstrated rather than described ── */
const THEME_KEY = 'aether-theme'
const theme = ref<'paper' | 'timber'>('paper')
const themeOpts: SegOption[] = [
  { value: 'paper', label: 'Light' },
  { value: 'timber', label: 'Dark' },
]
function applyTheme(t: 'paper' | 'timber') {
  theme.value = t
  document.documentElement.setAttribute('data-theme', t)
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    /* private mode — the switch still works for this session */
  }
}
onMounted(() => {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(THEME_KEY)
  } catch {
    /* ignore */
  }
  applyTheme(saved === 'timber' ? 'timber' : 'paper')
})

const KIT_VERSION = __KIT_VERSION__

/* ── stats: derived, never hand-counted, so they cannot go stale ── */
const stats = computed(() => ({
  components: COMPONENTS.length,
  cores: COMPONENTS.filter((c) => c.core).length,
  props: COMPONENTS.reduce((n, c) => n + c.props.length, 0),
}))

/* ── Seg ── */
const view = ref<'cards' | 'graph'>('cards')
const segOpts: SegOption[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'graph', label: 'Graph' },
]

/* ── Seg: pill variant ── */
/* Demoed as the TWO-capsule header it was extracted from — a view switch beside a layout
   switch — because the pairing is the point. The pill's mono uppercase and accent wash are what
   let two independent selectors share one header without reading as a single six-option control;
   a lone pill shows the styling but not the reason for it. Both are live, and #state prints both
   values, so it is visible that they select independently. */
const pillView = ref<'graph' | 'list' | 'tree'>('graph')
const pillViewOpts: SegOption[] = [
  { value: 'graph', label: 'Graph' },
  { value: 'list', label: 'List' },
  { value: 'tree', label: 'Tree' },
]
const pillLayout = ref<'force' | 'folders' | 'hubs'>('force')
const pillLayoutOpts: SegOption[] = [
  { value: 'force', label: 'Force' },
  { value: 'folders', label: 'Folders' },
  { value: 'hubs', label: 'Hubs' },
]

/* ── Chip ── */
const active = ref<Set<string>>(new Set(['fact', 'risk']))
const chipOpts: ChipOption[] = [
  { value: 'fact', label: 'Facts', count: 6, dotColor: 'var(--aether-cool-soft)' },
  { value: 'idea', label: 'Ideas', count: 3 },
  { value: 'risk', label: 'Risks', count: 2, dotColor: 'var(--aether-warm)' },
  { value: 'link', label: 'Links', count: 0, muted: true },
  { value: 'lane', label: 'Colour-accented', count: 4, color: 'var(--aether-warm)' },
  // a swatch carries the encoding of the thing being filtered, so the chips ARE the legend
  { value: 'planned', label: 'Planned', count: 5, swatch: 'border:1.5px dashed var(--aether-warm)' },
  { value: 'shipped', label: 'Shipped', count: 9, swatch: 'background:var(--aether-cool);opacity:.45' },
]
function toggleChip(v: string) {
  const next = new Set(active.value)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  active.value = next
}

/* ── Tool ── */
const pressed = ref(0)

/* ── FilterRail ── */
const railGroups = ref<FilterGroup[]>([
  {
    key: 'type',
    label: 'Type',
    selected: new Set<string>(),
    options: [
      { value: 'fact', label: 'Fact', count: 6, dotColor: 'var(--aether-cool)' },
      { value: 'idea', label: 'Idea', count: 3, dotColor: 'var(--aether-warm)' },
      { value: 'risk', label: 'Risk', count: 2 },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    selected: new Set<string>(),
    options: [
      { value: 'open', label: 'Open', count: 4 },
      { value: 'done', label: 'Done', count: 7 },
    ],
  },
])
const railHidden = ref(0)
function onRailToggle(groupKey: string, value: string) {
  const g = railGroups.value.find((x) => x.key === groupKey)
  if (!g) return
  const next = new Set(g.selected)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  g.selected = next
  railHidden.value = railGroups.value.reduce((n, gg) => n + gg.selected.size, 0)
}
function onRailClear() {
  railGroups.value.forEach((g) => (g.selected = new Set()))
  railHidden.value = 0
}

/* ── SearchField ── */
const query = ref('')
const cleared = ref(0)

/* ── Transport — the demo owns the clock; Transport renders + emits ── */
const tCur = ref(0)
const tDur = ref(6)
const tPlaying = ref(false)
const tSpeed = ref(1)
let tRaf = 0
let tLast = 0
function tStep(ts: number) {
  if (!tPlaying.value) return
  const dt = (ts - tLast) / 1000
  tLast = ts
  tCur.value += dt * tSpeed.value
  if (tCur.value >= tDur.value) {
    tCur.value = tDur.value
    tPlaying.value = false
    return
  }
  tRaf = requestAnimationFrame(tStep)
}
function tToggle() {
  if (tPlaying.value) {
    tPlaying.value = false
    return
  }
  if (tCur.value >= tDur.value) tCur.value = 0
  tPlaying.value = true
  tLast = performance.now()
  if (tRaf) cancelAnimationFrame(tRaf)
  tRaf = requestAnimationFrame(tStep)
}
function tSeek(t: number) {
  tCur.value = Math.max(0, Math.min(t, tDur.value))
}
let tWasPlaying = false
function tScrubStart() {
  tWasPlaying = tPlaying.value
  tPlaying.value = false
}
function tScrubEnd() {
  if (tWasPlaying) tToggle()
}

/* ── PropertyEditor ── */
const peFields: FieldDescriptor[] = [
  { key: 'title', label: 'Title', type: 'text', placeholder: 'Untitled' },
  { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Write…' },
  {
    key: 'kind',
    label: 'Kind',
    type: 'enum',
    variant: 'buttons',
    options: [
      { value: 'fact', label: 'Fact' },
      { value: 'idea', label: 'Idea' },
      { value: 'risk', label: 'Risk' },
    ],
  },
  { key: 'live', label: 'Live', type: 'boolean' },
]
const peValues: PEValues = { title: '', body: '', kind: 'fact', live: true }
const peOut = ref<PEValues>({ ...peValues })

/* ── Graph2D ──
 * Deliberately run CONTROLLED (:running="false"), the way a host that owns its own node
 * positions does: the caller owns nodes[].pos and drives the force sim with the exported
 * ForceLayout. That is the whole thesis made visible — the layout core is framework-free
 * and usable without the component, and the component only renders + emits. It is also the
 * only mode where dragging a node can work, because in running mode the component's
 * internal layout owns the positions and a caller's write is ignored. */
const palette = ['var(--aether-cool)', 'var(--aether-warm)', 'var(--aether-cool-soft)']
const GRAPH_W = 560
const GRAPH_H = 360
/* Positions are VIEWPORT coordinates and the sim is clamped to the stage, so the graph is
 * drawn 1:1: nothing can wander off the canvas and a dragged node sits exactly under the
 * cursor. Refitting the cloud every frame instead made the scale drift as nodes moved, and a
 * drag tracked at about a third of the pointer. */
const GRAPH_BOUNDS: [number, number, number, number] = [30, 24, GRAPH_W - 30, GRAPH_H - 20]
const gNodes = ref<GNode[]>(
  Array.from({ length: 18 }, (_, i) => ({
    id: 'n' + i,
    pos: [GRAPH_W / 2 + (Math.random() - 0.5) * 220, GRAPH_H / 2 + (Math.random() - 0.5) * 180, 0],
    label: i % 5 === 0 ? 'hub' + i : undefined,
    color: palette[i % 3],
    r: i % 5 === 0 ? 10 : 5,
  })),
)
const gEdges: GEdge[] = []
for (let i = 1; i < gNodes.value.length; i++) {
  const target = i % 5 === 0 ? i : Math.floor(i / 5) * 5
  gEdges.push({ a: 'n' + target, b: 'n' + i, w: 1 })
}
const gClicked = ref<string>('—')
const gSelected = ref<string | null>(null)
const gDragged = ref<string>('—')

// The gallery drives the kit's exported ForceLayout itself — the clearest possible proof
// that the layout core is framework-free and usable without the component. The sim owns its
// own node copies and we publish a fresh array each frame; replacing the objects (rather
// than mutating pos in place) is what actually makes Vue re-render.
const gLayout = new ForceLayout(
  gNodes.value.map((n) => ({ ...n, pos: [...n.pos] })),
  gEdges,
  { dims: 3, bounds: GRAPH_BOUNDS },
)
const publish = () => {
  gNodes.value = gLayout.nodes.map((n) => ({ ...n, pos: [...n.pos] }))
}
const gRunning = ref(true)
let gRaf = 0
function gLoop() {
  gLayout.step()
  publish()
  // the sim decides when it is done -- alpha decays every step and a drag re-heats it
  if (!gLayout.running) {
    gRunning.value = false
    return
  }
  gRaf = requestAnimationFrame(gLoop)
}
function ensureRunning() {
  if (gRunning.value) return
  gRunning.value = true
  gRaf = requestAnimationFrame(gLoop)
}
function gRerun() {
  gLayout.reheat(1)
  ensureRunning()
}
// neighbours of the selection, to show the `neighbors` emphasis prop doing something
const gNeighbors = computed<Set<string> | null>(() => {
  if (!gSelected.value) return null
  const s = new Set<string>([gSelected.value])
  for (const e of gEdges) {
    if (e.a === gSelected.value) s.add(e.b)
    if (e.b === gSelected.value) s.add(e.a)
  }
  return s
})
function onGraphNodeClick(id: string) {
  gClicked.value = id
  gSelected.value = gSelected.value === id ? null : id
}

/* Zoom is driven through the component's exposed methods rather than a prop, because the
 * host owns the chrome: the kit ships the behaviour, you ship the buttons.
 *
 * Bound with a FUNCTION ref, not `ref="gGraph"`. Every section here is rendered inside a
 * v-for, and a string ref under a v-for collects into an ARRAY -- so `gGraph.zoomIn` was
 * undefined and `gGraph?.zoomIn()` swallowed it silently: all three buttons dead, no error.
 * Same reason the Gantt host below uses a function ref. */
type GraphApi = { zoomIn: () => void; zoomOut: () => void; zoomFit: (pad?: number) => void }
const gGraph = ref<GraphApi | null>(null)
const gZoom = ref(1)

/* The hover card is the host's, not the kit's — Graph2D emits which node and where the
 * pointer is, and only the host knows what a node means. */
const gHover = ref<{ id: string; x: number; y: number } | null>(null)
function onGraphHover(id: string, x: number, y: number) {
  gHover.value = { id, x: x + 14, y: y + 14 }
}
const gHoverNode = computed(() =>
  gHover.value ? gNodes.value.find((n) => n.id === gHover.value!.id) : null,
)
const gHoverDegree = computed(() =>
  gHover.value ? gEdges.filter((e) => e.a === gHover.value!.id || e.b === gHover.value!.id).length : 0,
)
function onGraphDrag(id: string, x: number, y: number) {
  // `drag` reports viewport coords, and with mapping="direct" those ARE the coordinates the
  // layout works in — no inverse transform, and no scale to get wrong. Pin so the node tracks
  // the cursor, re-heat so its neighbours relax around it.
  gLayout.pin(id, [x, y, 0])
  // Publish straight away rather than waiting for the next animation frame. The frame is not
  // guaranteed — requestAnimationFrame is paused whenever the tab is not visible — and a node
  // that only follows the cursor while the sim happens to be ticking is a node that stutters.
  publish()
  gLayout.reheat(0.5)
  ensureRunning()
  gDragged.value = id
}
function onGraphDragEnd(id: string) {
  gLayout.unpin(id)
  gLayout.reheat(0.3) // let the neighbourhood settle back after release
  ensureRunning()
}
onMounted(() => {
  gRaf = requestAnimationFrame(gLoop)
})
onBeforeUnmount(() => cancelAnimationFrame(gRaf))

/* ── Gantt ── */
const gItems = ref<GanttItem[]>([
  { id: 'a1', start: 2, end: 9, type: 'design', status: 'done', title: 'Concept' },
  { id: 'a2', start: 10, end: 20, type: 'design', status: 'open', title: 'Schematics' },
  // several one-day items, some sharing a date: this is what the density row exists for
  { id: 'b1', start: 12, type: 'fabricate', status: 'open', title: 'Cut members' },
  { id: 'b3', start: 12, type: 'fabricate', status: 'done', title: 'Order plate' },
  { id: 'b4', start: 12, type: 'fabricate', status: 'open', title: 'Mark holes' },
  { id: 'b5', start: 34, type: 'fabricate', status: 'open', title: 'Ship batch' },
  { id: 'b2', start: 21, end: 30, type: 'fabricate', status: 'open', title: 'Weld frame' },
  { id: 'c1', start: 31, end: 45, type: 'erect', status: 'open', title: 'Site assembly' },
  { id: 'x1', start: 0, type: 'design', anchor: true, status: 'done', title: 'Day-0 kickoff' },
  { id: 'x2', start: 24, type: 'erect', anchor: true, status: 'open', title: 'Steel milestone' },
])
const gLanes: GanttLane[] = [
  { type: 'design', name: 'Design', color: 'var(--aether-cool-soft)', wash: 'var(--aether-cool-wash)' },
  { type: 'fabricate', name: 'Fabricate', color: 'var(--aether-warm)', wash: 'rgba(230,160,60,0.16)' },
  { type: 'erect', name: 'Erect', color: 'var(--aether-ink-soft)', wash: 'rgba(120,120,140,0.16)' },
]
const gSel = ref<string | null>(null)
const gExpanded = ref<string>('—')

/* Zoom to fit. The chart was pinned at 26px/day, so 60 days always came to 1560px and always
 * scrolled, even on a wide desktop with room to spare. computePPD divides the width we
 * actually have by the days we actually show, with a floor so a phone still gets a legible
 * chart behind a scroller rather than an illegible one that fits. */
const GANTT_DAYS = 60
// a fixed day index, not a real date: the component works in day indices, and a demo whose
// marker wanders with the calendar would be a demo nobody can screenshot
const GANTT_TODAY = 18
/* Week furniture. The component knows only day indices, so the CALLER decides which days are
 * weekends and where weeks begin -- that is what keeps Gantt usable on a schedule that is not
 * a calendar at all. Day 0 is treated as a Monday here. */
const gWeekends = Array.from({ length: GANTT_DAYS }, (_, i) => i).filter((i) => i % 7 === 5)
const gWeekdays = Array.from({ length: GANTT_DAYS }, (_, i) => i).filter((i) => i > 0 && i % 7 === 0)
const gWeekLabels = gWeekdays.map((d) => ({ day: d, label: 'W' + (d / 7 + 1) }))
const gantHost = ref<HTMLElement | null>(null)
const gPpd = ref(26)
let gRO: ResizeObserver | null = null
function measureGantt() {
  // NOTE: a plain `ref="..."` here would be collected into an ARRAY, because this sits
  // inside the v-for over components — clientWidth came back undefined and the chart
  // silently kept its default zoom. Hence the function ref.
  // Measure the SCROLLER, not the host: the chart also renders a lane-label gutter, so the
  // days get roughly 130px less than the section is wide. Sizing off the host overshot and
  // the chart still scrolled. clientWidth here is unaffected by ppd (only scrollWidth is),
  // so this cannot feed back into itself.
  const host = gantHost.value
  if (!host) return
  const scroller = host.querySelector('.ag-scroll') as HTMLElement | null
  const w = scroller?.clientWidth || host.clientWidth
  if (w > 0) gPpd.value = computePPD('all', w, GANTT_DAYS)
}
onMounted(() => {
  measureGantt()
  if (typeof ResizeObserver !== 'undefined') {
    gRO = new ResizeObserver(measureGantt)
    if (gantHost.value) gRO.observe(gantHost.value)
    // measure again once the chart has laid out and the scroller exists
    requestAnimationFrame(measureGantt)
  }
})
onBeforeUnmount(() => gRO?.disconnect())
// Period boundaries, deliberately NOT month names: Gantt works in day indices and never
// touches dates, so a demo naming real months would contradict the component it documents.
const gMarkers = [
  { day: 0, label: 'Month 1' },
  { day: 31, label: 'Month 2' },
]
function onGanttMove(id: string, start: number, end: number | null) {
  const it = gItems.value.find((x) => x.id === id)
  if (!it) return
  it.start = start
  it.end = end
}
function onGanttResize(id: string, edge: 'l' | 'r', value: number) {
  const it = gItems.value.find((x) => x.id === id)
  if (!it) return
  if (edge === 'l') it.start = value
  else it.end = value
}
function onGanttNewAt(day: number, type: string) {
  gItems.value.push({ id: 'n' + day + type, start: day, type, status: 'open', title: 'New ' + type })
}

// ── ChatPanel ──
// A fake round trip: Send marks the queued messages sent, Apply reply hands back a
// canned agent line. Real hosts export/import an actual file; the gallery mimics the
// round trip without one so the demo is self-contained.
const cMessages = ref<ChatMessage[]>([{ role: 'agent', text: 'Ready when you are.' }])
const cCompose = ref('')
function cQueue() {
  const t = cCompose.value.trim()
  if (!t) return
  cMessages.value.push({ role: 'you', text: t, queued: true })
  cCompose.value = ''
}
function cSend() {
  const reqs = cMessages.value.filter((m) => m.role === 'you' && m.queued)
  if (!reqs.length) return
  reqs.forEach((m) => (m.queued = false))
  cMessages.value.push({ role: 'sys', text: 'Sent ' + reqs.length + ' request(s) — exported as request.json.' })
}
function cApplyReply() {
  cMessages.value.push({ role: 'agent', text: 'Done — see the diff.' })
}

/* The component rail. Open state only matters below the dock breakpoint, where it is a
   sheet; above it the rail is permanently docked and this flag is inert. */
const railOpen = ref(false)
function onRailKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && railOpen.value) railOpen.value = false
}
onMounted(() => window.addEventListener('keydown', onRailKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onRailKey))

const groupAnchor = (g: Group) => g.toLowerCase()
</script>

<template>
  <a class="g-skip" href="#controls">Skip to components</a>

  <!-- The bar holds three things and only ever three: brand, the rail trigger, the theme
       switch. The component links used to live here too, and there is no width at which that
       works -- 10 components already overflowed a 1265px desktop by 89px, clipping Graph2D
       and Gantt behind a deliberately hidden scrollbar, and the list grows with every
       component added. They live in the rail below now. -->
  <nav class="g-nav">
    <div class="g-nav__in">
      <a class="g-nav__brand" href="#top">@aether/ui-kit</a>
      <button
        class="g-nav__trigger"
        type="button"
        :aria-expanded="railOpen"
        aria-controls="g-rail"
        @click="railOpen = !railOpen"
      >
        {{ railOpen ? 'Close' : 'Components' }}
      </button>
      <span class="g-nav__spacer" />
      <Seg
        :options="themeOpts"
        :model-value="theme"
        aria-label="Theme"
        @change="applyTheme($event as 'paper' | 'timber')"
      />
    </div>
  </nav>

  <!-- Docked beside the content on a wide screen, a dismissible sheet below that. One list,
       one source of truth, and it scrolls itself -- so it holds 25 components as happily as
       10, which the old strip could not. -->
  <aside id="g-rail" class="g-rail" :class="{ open: railOpen }" aria-label="Components">
    <template v-for="g in GROUPS" :key="g">
      <a class="g-rail__group" :href="'#' + groupAnchor(g)" @click="railOpen = false">{{ g }}</a>
      <a
        v-for="c in byGroup(g)"
        :key="c.id"
        class="g-rail__item"
        :href="'#' + c.id"
        @click="railOpen = false"
      >{{ c.name }}</a>
    </template>
  </aside>
  <div v-if="railOpen" class="g-rail__scrim" @click="railOpen = false"></div>

  <div id="top" class="gallery">
    <header class="g-hero">
      <h1>@aether/ui-kit</h1>
      <p class="g-hero__lede">
        Shared interface components for Aether's engineering surfaces — a framework-free core with a
        thin Vue wrapper, so the mechanics can outlive the framework.
      </p>
      <p class="g-hero__sub">
        Every component here runs in production in our own tools. The kit decides how a control
        <em>behaves</em>; what a category means, what a colour encodes, and what the data
        <em>is</em> stay with the caller.
      </p>
      <dl class="g-stats">
        <div><dt>Components</dt><dd>{{ stats.components }}</dd></div>
        <div><dt>Framework-free cores</dt><dd>{{ stats.cores }}</dd></div>
        <div><dt>Documented props</dt><dd>{{ stats.props }}</dd></div>
        <div><dt>Runtime dependencies</dt><dd>0</dd></div>
      </dl>
      <p class="g-hero__meta">
        <code>v{{ KIT_VERSION }}</code> · Apache-2.0 · Vue 3.5 peer dependency · no runtime dependencies of its
        own
      </p>
    </header>

    <section class="g-contract">
      <h2>The token contract</h2>
      <p>
        Components never hardcode a colour. They read <code>--aether-*</code> custom properties; the
        kit ships a light fallback palette so it renders standalone, and a host app overrides those
        tokens to make the kit its own. <strong>This page is that host</strong> — the light/dark
        switch above rewrites the tokens and every component below follows, with no component code
        involved.
      </p>
      <pre><code>/* in your app, after importing '@aether/ui-kit/styles' */
:root {
  --aether-surface: var(--my-surface);
  --aether-ink:     var(--my-ink);
  --aether-cool:    var(--my-accent);
}</code></pre>
      <p class="g-contract__warn">
        Import order matters: load <code>@aether/ui-kit/styles</code> <em>before</em> your own
        tokens. Both define <code>:root</code>, so on equal specificity the last one wins.
      </p>
    </section>

    <template v-for="g in GROUPS" :key="g">
      <h2 :id="groupAnchor(g)" class="g-group">{{ g }}</h2>

      <template v-for="c in byGroup(g)" :key="c.id">
        <!-- Controls -->
        <GSection v-if="c.id === 'seg'" :meta="c">
          <Seg
            :options="segOpts"
            :model-value="view"
            aria-label="View"
            @change="view = $event as 'cards' | 'graph'"
          />
          <Seg :options="[{ value: 'a', label: 'Only option' }]" :model-value="'a'" aria-label="Single" />
          <!-- variant="pill": the two adjacent capsules are the pattern this variant exists
               for, not decoration. Keep them next to each other. -->
          <Seg
            variant="pill"
            :options="pillViewOpts"
            :model-value="pillView"
            aria-label="Graph view"
            @change="pillView = $event as 'graph' | 'list' | 'tree'"
          />
          <Seg
            variant="pill"
            :options="pillLayoutOpts"
            :model-value="pillLayout"
            aria-label="Graph layout"
            @change="pillLayout = $event as 'force' | 'folders' | 'hubs'"
          />
          <template #state>
            view = "{{ view }}" · pill: {{ pillView }} / {{ pillLayout }}
          </template>
        </GSection>

        <GSection v-else-if="c.id === 'chip'" :meta="c">
          <Chip :options="chipOpts" :model-value="active" aria-label="Filters" @toggle="toggleChip" />
          <template #state>active = [{{ [...active].join(', ') || '∅' }}]</template>
        </GSection>

        <GSection v-else-if="c.id === 'tool'" :meta="c">
          <Tool label="New card" hot @click="pressed++" />
          <Tool label="Plain" @click="pressed++" />
          <Tool label="Delete" danger @click="pressed++" />
          <Tool label="Disabled" disabled @click="pressed++" />
          <template #state>clicks = {{ pressed }}</template>
        </GSection>

        <GSection v-else-if="c.id === 'filter-rail'" :meta="c">
          <div class="g-rails">
            <div>
              <span class="g-variant">orientation="vertical" — a filter sidebar</span>
              <FilterRail
                :groups="railGroups"
                :hidden-count="railHidden"
                @toggle="onRailToggle"
                @clear="onRailClear"
              />
            </div>
            <div>
              <span class="g-variant">orientation="horizontal" — the same rail as a header bar</span>
              <FilterRail
                :groups="railGroups"
                :hidden-count="railHidden"
                orientation="horizontal"
                @toggle="onRailToggle"
                @clear="onRailClear"
              />
            </div>
          </div>
          <template #state
            >active = {{ railGroups.flatMap((g2) => [...g2.selected]).join(', ') || '∅' }}</template
          >
        </GSection>

        <GSection v-else-if="c.id === 'search-field'" :meta="c">
          <SearchField
            v-model="query"
            placeholder="Search titles, paths, tags…"
            @clear="cleared++"
          />
          <template #state
            >query = {{ query ? '"' + query + '"' : '∅' }} · cleared {{ cleared }}×</template
          >
        </GSection>

        <GSection v-else-if="c.id === 'transport'" :meta="c">
          <Transport
            :current="tCur"
            :duration="tDur"
            :playing="tPlaying"
            :speed="tSpeed"
            @toggle="tToggle"
            @seek="tSeek"
            @set-speed="tSpeed = $event"
            @scrub-start="tScrubStart"
            @scrub-end="tScrubEnd"
            @stop="tCur = 0"
          />
          <template #state
            >cur = {{ tCur.toFixed(2) }}s · playing = {{ tPlaying }} · speed = {{ tSpeed }}×</template
          >
        </GSection>

        <!-- Forms -->
        <GSection v-else-if="c.id === 'property-editor'" :meta="c">
          <div class="g-pe">
            <PropertyEditor
              :fields="peFields"
              :model-value="peValues"
              @update:model-value="peOut = $event"
            />
          </div>
          <template #state>values = {{ JSON.stringify(peOut) }}</template>
        </GSection>

        <!-- Visualization -->
        <GSection v-else-if="c.id === 'graph2d'" :meta="c">
          <p class="g-hint">
            Drag a node — its neighbours follow. Click one to light its neighbourhood. Wheel or
            pinch to zoom, drag the background to pan; hover a node for the card.
            <button class="g-mini" type="button" @click="gRerun()">Re-run layout</button>
            <button class="g-mini" type="button" @click="gGraph?.zoomOut()">−</button>
            <button class="g-mini" type="button" @click="gGraph?.zoomIn()">+</button>
            <button class="g-mini" type="button" @click="gGraph?.zoomFit()">Fit</button>
          </p>
          <Graph2D
            :ref="(el) => (gGraph = el as unknown as GraphApi | null)"
            :nodes="gNodes"
            :edges="gEdges"
            :width="GRAPH_W"
            :height="GRAPH_H"
            mapping="direct"
            :running="false"
            :selection="gSelected"
            :neighbors="gNeighbors"
            zoomable
            @node-click="onGraphNodeClick"
            @drag="onGraphDrag"
            @drag-end="onGraphDragEnd"
            @zoom="gZoom = $event"
            @node-hover="onGraphHover"
            @node-leave="gHover = null"
          />
          <!-- the card lives in the host, positioned from the client coords the kit hands over -->
          <div
            v-if="gHover && gHoverNode"
            class="g-hovcard"
            :style="{ left: gHover.x + 'px', top: gHover.y + 'px' }"
          >
            <b>{{ gHoverNode.label || gHoverNode.id }}</b>
            <span>{{ gHoverDegree }} edge{{ gHoverDegree === 1 ? '' : 's' }} · r {{ gHoverNode.r }}</span>
          </div>
          <template #state
            >selected = {{ gSelected || '∅' }} · last drag = {{ gDragged }} · layout =
            {{ gRunning ? 'running' : 'settled' }} · nodes = {{ gNodes.length }} · zoom =
            {{ Math.round(gZoom * 100) }}%</template
          >
        </GSection>

        <GSection v-else-if="c.id === 'gantt'" :meta="c">
          <p class="g-hint">
            Drag a bar to move it, its edges to resize. Double-click empty lane space to
            create. Undo checkpoints come from drag-start / drag-end, not every pixel.
            The strip under each lane is the one-day row — three items share day 12, so they
            are stacked into one block rather than overlapping. Click it to expand them.
          </p>
          <div :ref="(el) => (gantHost = el as HTMLElement | null)" class="g-fill">
            <Gantt
              :items="gItems"
              :lanes="gLanes"
              :ppd="gPpd"
              :ndays="GANTT_DAYS"
              :current-day="GANTT_TODAY"
              :weekends="gWeekends"
              :weekdays="gWeekdays"
              :week-labels="gWeekLabels"
              :selection="gSel"
              :markers="gMarkers"
              @select="gSel = $event"
              @move="onGanttMove"
              @resize="onGanttResize"
              @new-at="onGanttNewAt"
              @expand-day="gExpanded = $event ? $event.t + ' day ' + $event.i : '—'"
            />
          </div>
          <template #state
            >selected = {{ gSel || '∅' }} · expanded = {{ gExpanded }} · zoom =
            {{ gPpd }}px/day · items = {{ gItems.length }}</template
          >
        </GSection>

        <GSection v-else-if="c.id === 'chat-panel'" :meta="c">
          <p class="g-hint">
            Type a line, hit Queue, then Send — the count on the button clears and a system
            note lands in the log. Apply reply hands back a canned response, the way a real
            host would after importing a reply file.
          </p>
          <div class="g-chat">
            <ChatPanel
              :messages="cMessages"
              v-model="cCompose"
              placeholder="Ask the agent…"
              @queue="cQueue"
              @send="cSend"
              @apply-reply="cApplyReply"
            >
              <template #empty>Queue a message, then Send to export a request file.</template>
            </ChatPanel>
          </div>
          <template #state
            >messages = {{ cMessages.length }} · queued =
            {{ cMessages.filter((m) => m.role === 'you' && m.queued).length }}</template
          >
        </GSection>
      </template>
    </template>

    <footer class="g-foot">
      <h2>Using the kit</h2>
      <pre><code>// once, at your app entry
import '@aether/ui-kit/styles'
import './your-tokens.css'   // after the kit — see the token contract above

// then, per component
import Seg from '@aether/ui-kit/controls/seg'</code></pre>
      <p>
        Each component exposes its own subpath, so a consumer pulls only what it uses. Components
        with a <span class="g-badge-inline">core</span> badge have a plain-TypeScript module
        underneath with no Vue import — that is the part designed to outlive this wrapper.
      </p>
    </footer>
  </div>
</template>

<style>
/* ── the gallery acting as a host app: it owns the --aether-* tokens ──
   Values are a real application's light and dark palettes, so what you see here is what the
   kit looks like in the app it was extracted from — not a gallery-only fiction. */
:root {
  --aether-surface: #fbf8f2;
  --aether-panel: #e5dfd2;
  --aether-ink: #1b1e23;
  --aether-ink-soft: #4a4f57;
  --aether-line: rgba(27, 30, 35, 0.14);
  --aether-line-strong: rgba(27, 30, 35, 0.26);
  --aether-warm: #a9591b;
  --aether-rose: #a33b52;
  --aether-cool: #2f6f6b;
  --aether-cool-soft: #5fa4a0;
  --aether-cool-wash: rgba(95, 164, 160, 0.15);
  --aether-shadow: 0 1px 2px rgba(27, 30, 35, 0.06);
  /* The rest of the contract. A host that maps only the obvious tokens silently inherits
     the kit's light fallbacks for the others -- which is precisely how a near-white
     --aether-warm-ink ended up on Timber's light amber at 2.02:1. A host defines the whole
     set or it does not really have a theme. */
  --aether-faint: #8a857a;
  --aether-warm-soft: #c8742e;
  --aether-warm-ink: #fbf8f2;
  --aether-rose-wash: rgba(163, 59, 82, 0.12);
  --aether-font-mono: var(--g-mono);
  --aether-transport-bg: rgba(251, 248, 242, 0.82);
  --aether-transport-backdrop: blur(8px) saturate(1.1);
  --aether-transport-radius: 10px;
  --aether-transport-shadow: 0 4px 20px rgba(27, 30, 35, 0.14);

  /* gallery-own chrome — deliberately NOT --aether-*, so it is obvious which tokens
     belong to the kit's contract and which are this page's own furniture */
  --g-page: #f4f0e8;
  --g-code: #efe9dd;
  --g-display: 'Fraunces', 'Iowan Old Style', Georgia, serif;
  --g-mono: 'Spline Sans Mono', ui-monospace, 'SF Mono', Consolas, monospace;
  --g-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
}
html[data-theme='timber'] {
  color-scheme: dark;
  --aether-surface: #13201f;
  --aether-panel: #22332f;
  --aether-ink: #eaf0ec;
  --aether-ink-soft: #c4d2ca;
  --aether-line: #22332f;
  --aether-line-strong: #2f4641;
  --aether-warm: #e5a45f;
  --aether-rose: #e08fa4;
  --aether-cool: #8fc6c2;
  --aether-cool-soft: #a8d8d4;
  --aether-cool-wash: rgba(143, 198, 194, 0.16);
  --aether-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  --aether-faint: #8fa39a;
  --aether-warm-soft: #c8742e;
  /* Timber inverts --aether-warm to a LIGHT amber, so the text sitting on it has to go
     dark. This is the token's whole reason for existing. */
  --aether-warm-ink: #0e1b1a;
  --aether-rose-wash: rgba(224, 143, 164, 0.16);
  --aether-font-mono: var(--g-mono);
  --aether-transport-bg: rgba(19, 32, 31, 0.8);
  --aether-transport-backdrop: blur(8px) saturate(1.1);
  --aether-transport-radius: 10px;
  --aether-transport-shadow: 0 4px 20px rgba(0, 0, 0, 0.45);

  --g-page: #0e1b1a;
  --g-code: #182726;
}

* {
  box-sizing: border-box;
}
body {
  margin: 0;
  font-family: var(--g-body);
  background: var(--g-page);
  color: var(--aether-ink);
  -webkit-font-smoothing: antialiased;
}

.g-skip {
  position: absolute;
  left: -9999px;
}
.g-skip:focus {
  left: 12px;
  top: 12px;
  z-index: 50;
  background: var(--aether-surface);
  color: var(--aether-ink);
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid var(--aether-line-strong);
}

/* ── sticky nav ── */
.g-nav {
  position: sticky;
  top: 0;
  z-index: 20;
  background: color-mix(in srgb, var(--g-page) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--aether-line);
}
.g-nav__in {
  max-width: 980px;
  margin: 0 auto;
  padding: 10px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.g-nav__brand {
  font-family: var(--g-mono);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--aether-ink);
  text-decoration: none;
  flex: none;
}
.g-nav__spacer {
  flex: 1 1 auto;
}
.g-nav__trigger {
  flex: none;
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--aether-line-strong);
  border-radius: var(--aether-radius);
  background: transparent;
  color: var(--aether-ink-soft);
  font-family: var(--g-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}
.g-nav__trigger:hover {
  color: var(--aether-ink);
  border-color: var(--aether-ink-soft);
}

/* ── component rail ──
   Sheet by default (any width below the dock breakpoint), docked beside the content above it.
   Its own scroll, so the list length stops being a layout constraint. */
.g-rail {
  position: fixed;
  z-index: 30;
  top: 50px;
  left: 0;
  bottom: 0;
  width: min(260px, 82vw);
  display: none;
  flex-direction: column;
  gap: 1px;
  padding: 14px 12px 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--g-page);
  border-right: 1px solid var(--aether-line);
  box-shadow: 6px 0 24px rgba(0, 0, 0, 0.16);
}
.g-rail.open {
  display: flex;
}
.g-rail__scrim {
  position: fixed;
  inset: 0;
  z-index: 25;
}
.g-rail__group {
  font-family: var(--g-mono);
  font-size: 9.5px;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
  opacity: 0.65;
  text-decoration: none;
  margin: 14px 0 4px;
  padding: 0 10px;
}
.g-rail__group:first-child {
  margin-top: 0;
}
.g-rail__item {
  display: flex;
  align-items: center;
  min-height: 36px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 13px;
  color: var(--aether-ink-soft);
  text-decoration: none;
}
.g-rail__item:hover {
  background: var(--aether-panel);
  color: var(--aether-cool);
}


.gallery {
  max-width: 980px;
  margin: 0 auto;
  padding: 44px 24px 90px;
}

/* ── hero ── */
.g-hero h1 {
  font-family: var(--g-display);
  font-size: 42px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0 0 14px;
}
.g-hero__lede {
  font-size: 17px;
  line-height: 1.6;
  max-width: 62ch;
  margin: 0 0 12px;
}
.g-hero__sub {
  font-size: 14.5px;
  line-height: 1.65;
  max-width: 62ch;
  color: var(--aether-ink-soft);
  margin: 0 0 26px;
}
.g-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0 0 16px;
  padding: 0;
}
.g-stats div {
  flex: 1 1 150px;
  border: 1px solid var(--aether-line);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--aether-surface);
}
.g-stats dt {
  font-family: var(--g-mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
}
.g-stats dd {
  margin: 4px 0 0;
  font-family: var(--g-display);
  font-size: 28px;
  font-weight: 600;
  line-height: 1;
}
.g-hero__meta {
  font-family: var(--g-mono);
  font-size: 11.5px;
  color: var(--aether-ink-soft);
  margin: 0;
}
.g-hero__meta code {
  font-family: inherit;
}

/* ── token contract ── */
.g-contract {
  margin: 40px 0 8px;
  padding: 22px 24px;
  border: 1px solid var(--aether-line);
  border-left: 3px solid var(--aether-cool);
  border-radius: 10px;
  background: var(--aether-surface);
}
.g-contract h2 {
  font-family: var(--g-display);
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 10px;
}
.g-contract p {
  font-size: 14px;
  line-height: 1.65;
  max-width: 68ch;
  margin: 0 0 12px;
  color: var(--aether-ink-soft);
}
.g-contract strong {
  color: var(--aether-ink);
}
.g-contract__warn {
  font-size: 13px;
  margin-bottom: 0 !important;
}
.g-contract pre,
.g-foot pre {
  margin: 0 0 12px;
  padding: 13px 15px;
  background: var(--g-code);
  border: 1px solid var(--aether-line);
  border-radius: 8px;
  overflow-x: auto;
}
.g-contract code,
.g-foot code {
  font-family: var(--g-mono);
  font-size: 12px;
  line-height: 1.6;
}

/* ── group heading ── */
.g-group {
  font-family: var(--g-mono);
  font-size: 10.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
  margin: 46px 0 0;
  scroll-margin-top: 70px;
}

.g-pe {
  width: 100%;
  max-width: 380px;
}
.g-fill {
  width: 100%;
  min-width: 0;
}
/* ChatPanel is height:100% internally (it's meant to fill a tab pane) -- the demo needs to
   BE that bounded box, or the log has nothing to scroll within. */
.g-chat {
  width: 100%;
  max-width: 480px;
  height: 360px;
  border: 1px solid var(--aether-line-strong);
  border-radius: var(--aether-radius);
  overflow: hidden;
}
.g-rails {
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 100%;
}
.g-hint {
  margin: 0 0 10px;
  font-size: 12.5px;
  color: var(--aether-ink-soft);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
/* The graph's hover card. Fixed, because it is positioned from the client coordinates
   Graph2D hands over — this is host chrome, deliberately not part of the component. */
.g-hovcard {
  position: fixed;
  z-index: 40;
  pointer-events: none;
  max-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 11px;
  border: 1px solid var(--aether-line-strong);
  border-radius: 9px;
  background: var(--aether-surface);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  font-size: 12px;
}
.g-hovcard span {
  font-family: var(--g-mono);
  font-size: 10.5px;
  color: var(--aether-faint);
}
.g-mini {
  border: 1px solid var(--aether-line-strong);
  background: var(--aether-surface);
  color: var(--aether-ink);
  border-radius: 6px;
  padding: 3px 9px;
  font-family: var(--g-mono);
  font-size: 11px;
  cursor: pointer;
}
.g-mini:hover {
  border-color: var(--aether-cool);
  color: var(--aether-cool);
}
.g-variant {
  display: block;
  margin-bottom: 8px;
  font-family: var(--g-mono);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  color: var(--aether-faint);
}

/* ── footer ── */
.g-foot {
  margin-top: 56px;
  border-top: 1px solid var(--aether-line);
  padding-top: 28px;
}
.g-foot h2 {
  font-family: var(--g-display);
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 12px;
}
.g-foot p {
  font-size: 13.5px;
  line-height: 1.65;
  color: var(--aether-ink-soft);
  max-width: 68ch;
}
.g-badge-inline {
  font-family: var(--g-mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--aether-line-strong);
}

@media (max-width: 720px) {
  .g-hero h1 {
    font-size: 32px;
  }
  /* the `.g-nav__links { display: none }` that used to live here is gone with the strip
     itself -- it left a phone with no component navigation whatsoever */
}

/* ── rail: docked ──
   1180px is where a 980px column and a 260px rail both fit without overlapping; below it the
   rail stays a sheet rather than squeezing either.
   Deliberately the LAST block in this stylesheet: `.gallery` and `.g-nav__in` both set the
   `margin` SHORTHAND (`0 auto`), which resets margin-left wholesale. Declared any earlier,
   this loses at equal specificity and the content renders underneath the rail -- which is
   exactly what it did when it sat next to the other rail rules. */
@media (min-width: 1180px) {
  .g-nav__trigger {
    display: none;
  }
  .g-rail {
    display: flex;
    top: 51px;
    box-shadow: none;
    background: transparent;
  }
  .g-rail__scrim {
    display: none;
  }
  .g-nav__in,
  .gallery {
    margin-left: 260px;
  }
}
</style>
