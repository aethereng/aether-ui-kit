<script setup lang="ts">
/* @aether/ui-kit gallery.
 *
 * This page is also the kit's own proof: it is a HOST APP. It defines the --aether-* tokens
 * itself (light + dark below) and the kit's components follow, which is exactly the contract
 * a consumer gets. The theme switch at the top is not a mock — it re-themes this page, and the
 * components re-theme with it because they never hardcode a colour. */
import { ref, onMounted, computed } from 'vue'
import GSection from './GSection.vue'
import { COMPONENTS, GROUPS, byGroup, type Group } from './meta'

import Seg from '@/controls/vue/Seg.vue'
import Chip from '@/controls/vue/Chip.vue'
import Tool from '@/controls/vue/Tool.vue'
import FilterRail from '@/controls/vue/FilterRail.vue'
import Transport from '@/controls/vue/Transport.vue'
import PropertyEditor from '@/property-editor/vue/PropertyEditor.vue'
import Graph2D from '@/viz/vue/Graph2D.vue'
import Gantt from '@/viz/vue/Gantt.vue'

import type { GNode, GEdge } from '@/viz/core'
import type { GanttItem, GanttLane } from '@/viz/core/gantt'
import type { SegOption, ChipOption, FilterGroup } from '@/controls/core/types'
import type { FieldDescriptor, FieldValues as PEValues } from '@/property-editor/core/types'

/* ── page theme — the kit's token contract, demonstrated rather than described ── */
const THEME_KEY = 'aether-theme'
const theme = ref<'paper' | 'timber'>('paper')
const themeOpts: SegOption[] = [
  { value: 'paper', label: 'Paper' },
  { value: 'timber', label: 'Timber' },
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

/* ── Chip ── */
const active = ref<Set<string>>(new Set(['fact', 'risk']))
const chipOpts: ChipOption[] = [
  { value: 'fact', label: 'Facts', count: 6, dotColor: 'var(--aether-cool-soft)' },
  { value: 'idea', label: 'Ideas', count: 3 },
  { value: 'risk', label: 'Risks', count: 2, dotColor: 'var(--aether-warm)' },
  { value: 'link', label: 'Links', count: 0, dotColor: 'transparent' },
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

/* ── Graph2D ── */
const palette = ['var(--aether-cool)', 'var(--aether-warm)', 'var(--aether-cool-soft)']
const gNodes: GNode[] = Array.from({ length: 18 }, (_, i) => ({
  id: 'n' + i,
  pos: [(Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, 0],
  label: i % 5 === 0 ? 'hub' + i : undefined,
  color: palette[i % 3],
  r: i % 5 === 0 ? 10 : 5,
}))
const gEdges: GEdge[] = []
for (let i = 1; i < gNodes.length; i++) {
  const target = i % 5 === 0 ? i : Math.floor(i / 5) * 5
  gEdges.push({ a: 'n' + target, b: 'n' + i, w: 1 })
}
const gClicked = ref<string>('—')

/* ── Gantt ── */
const gItems = ref<GanttItem[]>([
  { id: 'a1', start: 2, end: 9, type: 'design', status: 'done', title: 'Concept' },
  { id: 'a2', start: 10, end: 20, type: 'design', status: 'open', title: 'Schematics' },
  { id: 'b1', start: 12, type: 'fabricate', status: 'open', title: 'Cut members' },
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
const gMarkers = [
  { day: 0, label: 'Aug' },
  { day: 31, label: 'Sep' },
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

const groupAnchor = (g: Group) => g.toLowerCase()
</script>

<template>
  <a class="g-skip" href="#controls">Skip to components</a>

  <nav class="g-nav">
    <div class="g-nav__in">
      <a class="g-nav__brand" href="#top">@aether/ui-kit</a>
      <div class="g-nav__links">
        <template v-for="g in GROUPS" :key="g">
          <a class="g-nav__group" :href="'#' + groupAnchor(g)">{{ g }}</a>
          <a v-for="c in byGroup(g)" :key="c.id" class="g-nav__item" :href="'#' + c.id">{{
            c.name
          }}</a>
        </template>
      </div>
      <Seg
        :options="themeOpts"
        :model-value="theme"
        aria-label="Theme"
        @change="applyTheme($event as 'paper' | 'timber')"
      />
    </div>
  </nav>

  <div id="top" class="gallery">
    <header class="g-hero">
      <h1>@aether/ui-kit</h1>
      <p class="g-hero__lede">
        Shared interface components for Aether's engineering surfaces — a framework-free core with a
        thin Vue wrapper, so the mechanics can outlive the framework.
      </p>
      <p class="g-hero__sub">
        Every component here runs in production in AetherOS. The kit decides how a control
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
        <code>v0.1.0</code> · Apache-2.0 · Vue 3.5 peer dependency · no runtime dependencies of its
        own
      </p>
    </header>

    <section class="g-contract">
      <h2>The token contract</h2>
      <p>
        Components never hardcode a colour. They read <code>--aether-*</code> custom properties; the
        kit ships a light fallback palette so it renders standalone, and a host app overrides those
        tokens to make the kit its own. <strong>This page is that host</strong> — the Paper/Timber
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
          <template #state>view = "{{ view }}"</template>
        </GSection>

        <GSection v-else-if="c.id === 'chip'" :meta="c">
          <Chip :options="chipOpts" :model-value="active" aria-label="Filters" @toggle="toggleChip" />
          <template #state>active = [{{ [...active].join(', ') || '∅' }}]</template>
        </GSection>

        <GSection v-else-if="c.id === 'tool'" :meta="c">
          <Tool label="New card" hot @click="pressed++" />
          <Tool label="Plain" @click="pressed++" />
          <Tool label="Disabled" disabled @click="pressed++" />
          <template #state>clicks = {{ pressed }}</template>
        </GSection>

        <GSection v-else-if="c.id === 'filter-rail'" :meta="c">
          <FilterRail
            :groups="railGroups"
            :hidden-count="railHidden"
            @toggle="onRailToggle"
            @clear="onRailClear"
          />
          <template #state
            >active = {{ railGroups.flatMap((g2) => [...g2.selected]).join(', ') || '∅' }}</template
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
          <Graph2D
            :nodes="gNodes"
            :edges="gEdges"
            :width="560"
            :height="360"
            @node-click="gClicked = $event"
          />
          <template #state
            >clicked = {{ gClicked }} · nodes = {{ gNodes.length }} · edges =
            {{ gEdges.length }}</template
          >
        </GSection>

        <GSection v-else-if="c.id === 'gantt'" :meta="c">
          <Gantt
            :items="gItems"
            :lanes="gLanes"
            :ppd="26"
            :ndays="60"
            :selection="gSel"
            :markers="gMarkers"
            @select="gSel = $event"
            @move="onGanttMove"
            @resize="onGanttResize"
            @new-at="onGanttNewAt"
          />
          <template #state>selected = {{ gSel || '∅' }} · items = {{ gItems.length }}</template>
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
   Values are AetherOS's real Paper/Timber palettes, so what you see here is what the
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
.g-nav__links {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex: 1 1 auto;
  overflow-x: auto;
  scrollbar-width: none;
}
.g-nav__links::-webkit-scrollbar {
  display: none;
}
.g-nav__group {
  font-family: var(--g-mono);
  font-size: 9.5px;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
  opacity: 0.65;
  text-decoration: none;
  margin-left: 6px;
  white-space: nowrap;
}
.g-nav__group:first-child {
  margin-left: 0;
}
.g-nav__item {
  font-size: 12.5px;
  color: var(--aether-ink-soft);
  text-decoration: none;
  white-space: nowrap;
}
.g-nav__item:hover {
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
  .g-nav__links {
    display: none;
  }
}
</style>
