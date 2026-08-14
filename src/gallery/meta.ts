/* Gallery metadata — the single source for section titles, import lines, API tables, and the
 * worked example shown under each demo.
 *
 * Every prop and emit below is transcribed from the component's own defineProps/defineEmits.
 * If a signature changes and this file does not, the gallery is lying — so treat this as part
 * of the component contract, not documentation about it.
 *
 * `template` and `script` are the COMPLETE example, including the data. A snippet that omits
 * where `items` came from is the snippet everyone has to reverse-engineer, so these are
 * written to be copied and run rather than only read.
 *
 * `core` names the framework-free module a component sits on, when it has one. That split is
 * the kit's whole architecture: mechanics in a plain-TS core, a thin wrapper per framework.
 */

export type Group = 'Controls' | 'Forms' | 'Visualization'

export interface ApiRow {
  name: string
  type: string
  note?: string
}

export interface CompMeta {
  id: string
  name: string
  subpath: string
  group: Group
  /** One line: what it is. Shown under the heading. */
  blurb: string
  /** Optional second paragraph for the pieces that need the reasoning stated. */
  detail?: string
  /** Framework-free core module, when the component has one. */
  core?: string
  props: ApiRow[]
  emits: ApiRow[]
  /** Methods and refs reachable through a template ref, for the components that expose any. */
  exposed?: ApiRow[]
  /** The example's markup. */
  template: string
  /** The example's script, including its data — a snippet you can actually run. */
  script: string
}

export const COMPONENTS: CompMeta[] = [
  {
    id: 'seg',
    name: 'Seg',
    subpath: '@aether/ui-kit/controls/seg',
    group: 'Controls',
    blurb: 'One-active segmented selector.',
    props: [
      { name: 'options', type: 'SegOption<V>[]', note: '{ value, label, disabled? }' },
      { name: 'modelValue', type: 'V', note: 'the active value' },
      { name: 'ariaLabel', type: 'string?', note: 'labels the group for screen readers' },
      { name: 'variant', type: "'default' | 'pill'?", note: 'toolbar control vs mono capsule header' },
    ],
    emits: [
      { name: 'update:modelValue', type: '[value: V]', note: 'v-model' },
      { name: 'change', type: '[value: V]', note: 'same value, for non-v-model callers' },
    ],
    template: `<Seg
  :options="viewOptions"
  :model-value="view"
  aria-label="View"
  @change="view = $event"
/>`,
    script: `import { ref } from 'vue'
import Seg from '@aether/ui-kit/controls/seg'
import type { SegOption } from '@aether/ui-kit/controls/core'

const view = ref<'cards' | 'graph'>('cards')

const viewOptions: SegOption[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'graph', label: 'Graph' },
]`,
  },
  {
    id: 'chip',
    name: 'Chip',
    subpath: '@aether/ui-kit/controls/chip',
    group: 'Controls',
    core: '@aether/ui-kit/controls/core',
    blurb: 'Toggle chips with an optional count and colour dot. Multi-select via a Set.',
    detail:
      'The dot colour is a caller concern — the kit never decides what a category means, only how a chip behaves. `color` accents the label itself (an option can carry its encoding without a dot); `muted` dims an option without disabling it, for a filter whose count is zero but which should still be visible and clickable. `swatch` takes a raw CSS declaration list rather than a colour, so a chip can carry the same encoding as the thing it filters — a dashed border for planned, a faded fill for shipped — which is what lets a set of chips replace a legend instead of sitting beside one.',
    props: [
      {
        name: 'options',
        type: 'ChipOption<V>[]',
        note: '{ value, label, count?, dotColor?, swatch?, color?, muted?, disabled? }',
      },
      { name: 'modelValue', type: 'V | Set<V>', note: 'single value or a Set for multi-select' },
      { name: 'variant', type: "'pill' | 'row'?", note: 'inline filter chip vs sidebar list row' },
      { name: 'ariaLabel', type: 'string?' },
    ],
    emits: [{ name: 'toggle', type: '[value: V]', note: 'caller owns the Set; chip only reports' }],
    template: `<Chip
  :options="chipOptions"
  :model-value="active"
  aria-label="Filter by kind"
  @toggle="toggle"
/>`,
    script: `import { ref } from 'vue'
import Chip from '@aether/ui-kit/controls/chip'
import type { ChipOption } from '@aether/ui-kit/controls/core'

// multi-select: the caller owns the Set, the chip only reports a toggle
const active = ref<Set<string>>(new Set(['fact', 'risk']))

const chipOptions: ChipOption[] = [
  { value: 'fact', label: 'Facts', count: 6, dotColor: 'var(--aether-cool-soft)' },
  { value: 'idea', label: 'Ideas', count: 3 },
  { value: 'risk', label: 'Risks', count: 2, dotColor: 'var(--aether-warm)' },
  { value: 'link', label: 'Links', count: 0, muted: true },
  { value: 'lane', label: 'Colour-accented', count: 4, color: 'var(--aether-warm)' },
]

function toggle(v: string) {
  const next = new Set(active.value)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  active.value = next
}`,
  },
  {
    id: 'tool',
    name: 'Tool',
    subpath: '@aether/ui-kit/controls/tool',
    group: 'Controls',
    blurb: 'Header action button, in three variants: neutral, primary, destructive.',
    detail:
      'A closed variant set rather than an open style hook. If both hot and danger are passed, danger wins — mislabelling a destructive action as primary is the worse failure.',
    props: [
      { name: 'label', type: 'string' },
      { name: 'hot', type: 'boolean?', note: 'the primary action on a surface' },
      { name: 'danger', type: 'boolean?', note: 'destructive — delete, discard' },
      { name: 'disabled', type: 'boolean?' },
      { name: 'title', type: 'string?', note: 'native tooltip' },
    ],
    emits: [{ name: 'click', type: '[]' }],
    template: `<Tool label="New card" hot @click="create()" />
<Tool label="Plain" @click="noop()" />
<Tool label="Delete" danger @click="remove()" />
<Tool label="Disabled" disabled />`,
    script: `import Tool from '@aether/ui-kit/controls/tool'

function create() {
  /* … */
}
function remove() {
  /* … */
}
function noop() {}`,
  },
  {
    id: 'filter-rail',
    name: 'FilterRail',
    subpath: '@aether/ui-kit/controls/filter-rail',
    group: 'Controls',
    blurb: 'A labelled rail of toggle-chip groups, with clear-all and a hidden-count readout.',
    detail:
      'Grouping and selection are pure data (FilterGroup[]); the rail renders one Chip row per group and wires toggle/clear mechanically. The one component extracted after a three-surface duplication audit — the other candidates were rejected as look-alikes. Both real consumers ship: one as a vertical sidebar, one as a horizontal header bar.',
    props: [
      { name: 'groups', type: 'FilterGroup<V>[]', note: '{ key, label, options, selected: Set<V> }' },
      { name: 'hiddenCount', type: 'number?', note: 'shown as "N hidden" when non-zero' },
      { name: 'clearLabel', type: 'string?', note: 'defaults to "clear"' },
      {
        name: 'orientation',
        type: "'vertical' | 'horizontal'?",
        note: 'sidebar rail vs header bar; default vertical',
      },
    ],
    emits: [
      { name: 'toggle', type: '[groupKey: string, value: V]' },
      { name: 'clear', type: '[]' },
    ],
    template: `<FilterRail
  :groups="groups"
  :hidden-count="hidden"
  orientation="vertical"
  @toggle="onToggle"
  @clear="onClear"
/>`,
    script: `import { ref } from 'vue'
import FilterRail from '@aether/ui-kit/controls/filter-rail'
import type { FilterGroup } from '@aether/ui-kit/controls/core'

const groups = ref<FilterGroup[]>([
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
const hidden = ref(0)

function onToggle(groupKey: string, value: string) {
  const g = groups.value.find((x) => x.key === groupKey)
  if (!g) return
  const next = new Set(g.selected)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  g.selected = next
  hidden.value = groups.value.reduce((n, gg) => n + gg.selected.size, 0)
}

function onClear() {
  groups.value.forEach((g) => (g.selected = new Set()))
  hidden.value = 0
}`,
  },
  {
    id: 'search-field',
    name: 'SearchField',
    subpath: '@aether/ui-kit/controls/search-field',
    group: 'Controls',
    blurb: 'Search input with a clear button that appears only once there is something to clear.',
    detail:
      'Extracted after two surfaces shipped it identically — same wrapper, same absolutely positioned circular button, same glyph, down to matching CSS in both source files. An always-visible clear button on an empty field is a control that does nothing, so it stays hidden until the field has text; clearing returns the caret to the input, because clearing is almost always followed by retyping.',
    props: [
      { name: 'modelValue', type: 'string', note: 'the query — the caller owns it' },
      { name: 'placeholder', type: 'string?' },
      { name: 'ariaLabel', type: 'string?', note: 'defaults to the placeholder' },
      { name: 'clearLabel', type: 'string?', note: 'tooltip + accessible name for the clear button' },
    ],
    emits: [
      { name: 'update:modelValue', type: '[value: string]', note: 'v-model' },
      { name: 'clear', type: '[]', note: 'fires alongside the empty update, for callers that reset more than the query' },
    ],
    template: `<SearchField
  v-model="q"
  placeholder="Search titles, paths, tags…"
  @clear="onClear"
/>`,
    script: `import { ref } from 'vue'
import SearchField from '@aether/ui-kit/controls/search-field'

const q = ref('')

// the clear event is for anything BEYOND emptying the query — resetting a
// page, collapsing a result tree — since v-model already handles the string
function onClear() {
  /* … */
}`,
  },
  {
    id: 'transport',
    name: 'Transport',
    subpath: '@aether/ui-kit/controls/transport',
    group: 'Controls',
    core: '@aether/ui-kit/controls/core',
    blurb:
      'Controlled playback transport: play/pause/replay, scrub, speed presets, position readout.',
    detail:
      'Pauses on scrub-start and resumes on scrub-end, so a drag and a running clock can never both write the playhead — the release is caught on the window, so a pointer let go outside the slider cannot strand playback paused. Deliberately unit-agnostic: the same component drives simulation seconds and calendar days. It sizes and positions nothing; both real consumers float it over a 3-D canvas at their own width. Shipping in two applications: a 3-D playback player, and a solver diagnostic.',
    props: [
      { name: 'current', type: 'number', note: 'playhead position — caller owns the clock' },
      { name: 'duration', type: 'number' },
      { name: 'playing', type: 'boolean' },
      { name: 'speed', type: 'number?' },
      { name: 'speeds', type: 'number[]?', note: 'selectable presets' },
      { name: 'phase', type: "'play' | 'precompute'?", note: 'shows a progress bar while building' },
      { name: 'precomputePct', type: 'number?' },
      { name: 'format', type: '(t: number) => string?', note: 'override the readout formatting' },
      {
        name: 'speedMode',
        type: "'cycle' | 'presets'?",
        note: 'one stepping button vs the whole ladder',
      },
      { name: 'speedLabel', type: '(s: number) => string?', note: 'e.g. ½× instead of 0.5×' },
      { name: 'stoppable', type: 'boolean?', note: 'render the dismiss button; default true' },
      { name: 'computeLabel', type: 'string?', note: 'text beside the precompute bar' },
    ],
    emits: [
      { name: 'toggle', type: '[]' },
      { name: 'seek', type: '[t: number]' },
      { name: 'set-speed', type: '[s: number]' },
      { name: 'stop', type: '[]' },
      { name: 'scrub-start', type: '[]' },
      { name: 'scrub-end', type: '[]' },
    ],
    template: `<Transport
  :current="t"
  :duration="dur"
  :playing="playing"
  :speed="speed"
  @toggle="togglePlay"
  @seek="t = $event"
  @set-speed="speed = $event"
  @scrub-start="onScrubStart"
  @scrub-end="onScrubEnd"
/>`,
    script: `import { ref } from 'vue'
import Transport from '@aether/ui-kit/controls/transport'
import { beginScrub, endScrub, type ScrubHandle } from '@aether/ui-kit/controls/core'

// The CALLER owns the clock — Transport only renders it and emits intent.
const t = ref(0)
const dur = ref(6)
const playing = ref(false)
const speed = ref(1)

let raf = 0
let last = 0
function step(ts: number) {
  if (!playing.value) return
  t.value += ((ts - last) / 1000) * speed.value
  last = ts
  if (t.value >= dur.value) {
    t.value = dur.value
    playing.value = false
    return
  }
  raf = requestAnimationFrame(step)
}

function togglePlay() {
  if (playing.value) {
    playing.value = false
    return
  }
  if (t.value >= dur.value) t.value = 0
  playing.value = true
  last = performance.now()
  raf = requestAnimationFrame(step)
}

// Scrubbing while playing would put two writers on one playhead, so the drag pauses
// playback and hands it back on release. That rule lives in the core, unit-tested.
let scrub: ScrubHandle = beginScrub(false)
function onScrubStart() {
  scrub = beginScrub(playing.value)
  playing.value = false
}
function onScrubEnd() {
  if (endScrub(scrub, playing.value)) togglePlay()
}`,
  },
  {
    id: 'property-editor',
    name: 'PropertyEditor',
    subpath: '@aether/ui-kit/property-editor',
    group: 'Forms',
    core: '@aether/ui-kit/property-editor/core',
    blurb: 'Schema-driven form: bind a FieldDescriptor[], get an editor.',
    detail:
      'Text, textarea, date, boolean, and enum (button-group or dropdown) fields. The core is plain TypeScript with unit tests and no DOM; the Vue file is a thin wrapper. It stays ignorant of what the object being edited actually is.',
    props: [
      { name: 'fields', type: 'FieldDescriptor[]', note: '{ key, label, type, options?, … }' },
      { name: 'modelValue', type: 'FieldValues', note: 'a plain record' },
    ],
    emits: [
      { name: 'update:modelValue', type: '[values: FieldValues]' },
      { name: 'change', type: '[key: string, value: unknown]', note: 'per-field, for undo hooks' },
    ],
    template: `<PropertyEditor
  :fields="fields"
  :model-value="values"
  @change="onChange"
/>`,
    script: `import { ref } from 'vue'
import PropertyEditor from '@aether/ui-kit/property-editor'
import type { FieldDescriptor, FieldValues } from '@aether/ui-kit/property-editor/core'

const fields: FieldDescriptor[] = [
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

const values = ref<FieldValues>({ title: '', body: '', kind: 'fact', live: true })

// per-field change is the hook an undo stack wants — one entry per edit
function onChange(key: string, value: unknown) {
  values.value = { ...values.value, [key]: value }
}`,
  },
  {
    id: 'graph2d',
    name: 'Graph2D',
    subpath: '@aether/ui-kit/viz/graph',
    group: 'Visualization',
    core: '@aether/ui-kit/viz/core',
    blurb: 'Force-directed graph over an SVG renderer.',
    detail:
      'The core is dimension-agnostic — positions are `number[]`, so axis 3 can be spatial z, axis 4 a construction sequence, axis 5 a discipline. A GL renderer would reuse the same core and change only the draw call. Two modes: running (the component owns the sim, the default) or controlled (running: false, the caller owns nodes[].pos). Dragging needs the controlled mode — in running mode the internal layout owns the positions and a write from the caller is ignored.',
    props: [
      { name: 'nodes', type: 'GNode[]', note: '{ id, pos: number[], label?, color?, r? }' },
      { name: 'edges', type: 'GEdge[]', note: '{ a, b, w? }' },
      { name: 'width', type: 'number?' },
      { name: 'height', type: 'number?' },
      { name: 'projection', type: "'ortho2d' | 'iso3d'?", note: 'how N-D positions flatten to 2-D' },
      { name: 'running', type: 'boolean?', note: 'default true — the component owns the sim' },
      { name: 'selection', type: 'string | null?' },
      { name: 'neighbors', type: 'Set<string> | null?', note: 'emphasise a neighbourhood' },
      {
        name: 'zoomable',
        type: 'boolean?',
        note: 'default false — wheel/pinch zoom, background-drag pan. Off by default because a graph that eats the wheel is hostile inside a scrolling page.',
      },
      { name: 'minZoom', type: 'number?', note: 'default 0.25' },
      { name: 'maxZoom', type: 'number?', note: 'default 6' },
    ],
    emits: [
      { name: 'nodeClick', type: '[id: string]' },
      { name: 'nodeDown', type: '[id: string, x: number, y: number]' },
      {
        name: 'drag',
        type: '[id: string, x: number, y: number]',
        note: 'world coords — the view transform is already inverted, so a drag lands under the cursor at any zoom',
      },
      { name: 'dragEnd', type: '[id: string]' },
      { name: 'zoom', type: '[k: number]', note: 'current scale, after every zoom' },
      {
        name: 'nodeHover',
        type: '[id: string, clientX: number, clientY: number]',
        note: 'on entry and on every move while it stays there. The kit does not own tooltip content — only you know what a node means, so you render the card.',
      },
      { name: 'nodeLeave', type: '[]' },
    ],
    exposed: [
      { name: 'zoomIn()', type: '() => void' },
      { name: 'zoomOut()', type: '() => void' },
      { name: 'zoomFit(pad?)', type: '(pad?: number) => void', note: 'scales the content box into the viewport; undoes a pan too' },
      { name: 'zoomAt(x, y, factor)', type: '(x, y, factor) => void', note: 'zoom about a point in viewBox coords' },
      { name: 'zoom', type: 'Ref<number>', note: 'the current scale' },
    ],
    template: `<Graph2D
  ref="graph"
  :nodes="nodes"
  :edges="edges"
  :width="560"
  :height="360"
  :running="false"
  :selection="selected"
  :neighbors="neighbors"
  zoomable
  @node-click="onNodeClick"
  @drag="onDrag"
  @node-hover="onHover"
  @node-leave="hover = null"
/>

<!-- the chrome is yours: the kit ships the behaviour, you ship the buttons -->
<button @click="graph?.zoomOut()">−</button>
<button @click="graph?.zoomIn()">+</button>
<button @click="graph?.zoomFit()">Fit</button>`,
    script: `import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import Graph2D from '@aether/ui-kit/viz/graph'
import { ForceLayout } from '@aether/ui-kit/viz/core'
import type { GNode, GEdge } from '@aether/ui-kit/viz/core'

const nodes = ref<GNode[]>(
  Array.from({ length: 18 }, (_, i) => ({
    id: 'n' + i,
    pos: [(Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, 0],
    label: i % 5 === 0 ? 'hub' + i : undefined,
    r: i % 5 === 0 ? 10 : 5,
  })),
)

const edges: GEdge[] = []
for (let i = 1; i < nodes.value.length; i++) {
  edges.push({ a: 'n' + (i % 5 === 0 ? i : Math.floor(i / 5) * 5), b: 'n' + i, w: 1 })
}

// Drive the framework-free layout core yourself — this is the controlled mode.
// Publish NEW node objects each frame; mutating pos in place will not re-render.
const layout = new ForceLayout(
  nodes.value.map((n) => ({ ...n, pos: [...n.pos] })),
  edges,
  { dims: 3 },
)
const publish = () => {
  nodes.value = layout.nodes.map((n) => ({ ...n, pos: [...n.pos] }))
}

let raf = 0
let steps = 0
function loop() {
  layout.step()
  publish()
  steps += 1
  if (steps >= 220) return // converged — stop burning frames
  raf = requestAnimationFrame(loop)
}
onMounted(() => (raf = requestAnimationFrame(loop)))
onBeforeUnmount(() => cancelAnimationFrame(raf))

const selected = ref<string | null>(null)
const neighbors = computed(() => {
  if (!selected.value) return null
  const s = new Set([selected.value])
  for (const e of edges) {
    if (e.a === selected.value) s.add(e.b)
    if (e.b === selected.value) s.add(e.a)
  }
  return s
})

function onNodeClick(id: string) {
  selected.value = selected.value === id ? null : id
}

function onDrag(id: string, x: number, y: number) {
  const n = layout.nodes.find((v) => v.id === id)
  if (!n) return
  n.pos = [x - 280, y - 180, n.pos[2] ?? 0] // viewport -> world; the caller decides
  publish()
}

// Zoom controls come from the component's exposed methods, through a template ref.
const graph = ref<{ zoomIn(): void; zoomOut(): void; zoomFit(pad?: number): void } | null>(null)

// The hover card is yours. Graph2D says WHICH node and WHERE the pointer is; what a node
// means — a file, a part, a person — is knowledge the kit does not have.
const hover = ref<{ id: string; x: number; y: number } | null>(null)
function onHover(id: string, clientX: number, clientY: number) {
  hover.value = { id, x: clientX + 14, y: clientY + 14 }
}`,
  },
  {
    id: 'gantt',
    name: 'Gantt',
    subpath: '@aether/ui-kit/viz/gantt',
    group: 'Visualization',
    core: '@aether/ui-kit/viz/core/gantt',
    blurb: 'Controlled timeline: lanes, spans, points and anchors in day-index space.',
    detail:
      'Drag to move, edge-handles to resize, double-click a lane to create. It emits deltas in day indices and never touches dates — the caller maps day index to calendar, which is what keeps it reusable outside a calendar entirely.',
    props: [
      { name: 'items', type: 'GanttItem[]', note: '{ id, start, end?, type, status, anchor? }' },
      { name: 'lanes', type: 'GanttLane[]', note: '{ type, name, color, wash }' },
      { name: 'ppd', type: 'number', note: 'pixels per day — the zoom control' },
      { name: 'ndays', type: 'number' },
      { name: 'currentDay', type: 'number | null?', note: 'draws the today marker' },
      { name: 'selection', type: 'string | null?' },
      { name: 'markers', type: '{ day, label }[]?', note: 'month lines' },
      { name: 'weekends', type: 'number[]?' },
      { name: 'weekdays', type: 'number[]?' },
    ],
    emits: [
      { name: 'select', type: '[id: string]' },
      {
        name: 'dragStart',
        type: '[id: string]',
        note: 'once, before the first move — snapshot here',
      },
      { name: 'move', type: '[id, start, end | null]' },
      { name: 'resize', type: "[id, edge: 'l' | 'r', value]" },
      {
        name: 'dragEnd',
        type: '[id: string]',
        note: 'once, when a moved gesture ends — persist here',
      },
      { name: 'newAt', type: '[day: number, type: string]' },
      { name: 'expandDay', type: '[day | null]', note: 'many one-day items on the same date' },
    ],
    template: `<Gantt
  :items="items"
  :lanes="lanes"
  :ppd="26"
  :ndays="60"
  :selection="selected"
  :markers="markers"
  @select="selected = $event"
  @drag-start="snapshotForUndo"
  @move="onMove"
  @resize="onResize"
  @drag-end="persist"
  @new-at="onNewAt"
/>`,
    script: `import { ref } from 'vue'
import Gantt from '@aether/ui-kit/viz/gantt'
import type { GanttItem, GanttLane } from '@aether/ui-kit/viz/core/gantt'

// Day indices, not dates — the caller maps them to a calendar.
const items = ref<GanttItem[]>([
  { id: 'a1', start: 2, end: 9, type: 'design', status: 'done', title: 'Concept' },
  { id: 'a2', start: 10, end: 20, type: 'design', status: 'open', title: 'Schematics' },
  { id: 'b1', start: 12, type: 'fabricate', status: 'open', title: 'Cut members' },
  { id: 'c1', start: 31, end: 45, type: 'erect', status: 'open', title: 'Site assembly' },
  { id: 'x2', start: 24, type: 'erect', anchor: true, status: 'open', title: 'Steel milestone' },
])

const lanes: GanttLane[] = [
  {
    type: 'design',
    name: 'Design',
    color: 'var(--aether-cool-soft)',
    wash: 'var(--aether-cool-wash)',
  },
  { type: 'fabricate', name: 'Fabricate', color: 'var(--aether-warm)', wash: 'rgba(230,160,60,0.16)' },
  { type: 'erect', name: 'Erect', color: 'var(--aether-ink-soft)', wash: 'rgba(120,120,140,0.16)' },
]

const markers = [
  { day: 0, label: 'Month 1' },
  { day: 31, label: 'Month 2' },
]
const selected = ref<string | null>(null)

// dragStart/dragEnd fire ONCE per gesture — one undo entry per drag, not one per pixel
function snapshotForUndo() {
  /* push items onto an undo stack */
}
function persist() {
  /* save */
}

function onMove(id: string, start: number, end: number | null) {
  const it = items.value.find((x) => x.id === id)
  if (!it) return
  it.start = start
  it.end = end ?? undefined
}

function onResize(id: string, edge: 'l' | 'r', value: number) {
  const it = items.value.find((x) => x.id === id)
  if (!it) return
  if (edge === 'l') it.start = value
  else it.end = value
}

function onNewAt(day: number, type: string) {
  items.value.push({ id: 'n' + day + type, start: day, type, status: 'open', title: 'New ' + type })
}`,
  },
  {
    id: 'chat-panel',
    name: 'ChatPanel',
    subpath: '@aether/ui-kit/controls/chat-panel',
    group: 'Controls',
    core: '@aether/ui-kit/controls/core',
    blurb: 'A message log and compose box for the "queue, send, apply the reply" agent pattern.',
    detail:
      'Extracted after two hosts shipped it identically — a file browser and a card board — with only the export/import logic actually differing between them. The split follows from that: ChatPanel owns the log and the compose box, and emits queue / send / apply-reply; what those three DO — building a request file, importing a reply — stays with the caller entirely. Auto-scrolls to the newest message on its own, so no host has to reach into its DOM for that. Shipping in two applications: a knowledge-graph browser and a decision board.',
    props: [
      { name: 'messages', type: 'ChatMessage[]', note: "{ role: 'you'|'agent'|'sys', text, queued?, refs? }" },
      { name: 'modelValue', type: 'string', note: 'the compose box — caller owns it' },
      { name: 'placeholder', type: 'string?' },
      { name: 'queueLabel', type: 'string?', note: "default 'Queue'" },
      { name: 'sendLabel', type: 'string?', note: "default 'Send'" },
      { name: 'applyLabel', type: 'string?', note: "default 'Apply reply'" },
      { name: 'historyLimit', type: 'number?', note: 'most recent N rendered — default 50' },
    ],
    emits: [
      { name: 'update:modelValue', type: '[value: string]' },
      { name: 'queue', type: '[]', note: 'Queue button, or Ctrl/Cmd+Enter in the textarea' },
      { name: 'send', type: '[]' },
      { name: 'apply-reply', type: '[]' },
    ],
    exposed: [{ name: 'focus()', type: '() => void', note: 'for an "ask about this" shortcut that prefills modelValue and jumps to the box' }],
    template: `<ChatPanel
  ref="panel"
  :messages="messages"
  v-model="compose"
  placeholder="Ask the agent…"
  @queue="queue"
  @send="send"
  @apply-reply="applyReply"
>
  <template #empty>Queue a message, then Send to export a request file.</template>
</ChatPanel>`,
    script: `import { ref } from 'vue'
import ChatPanel from '@aether/ui-kit/controls/chat-panel'
import type { ChatMessage } from '@aether/ui-kit/controls/core'

const messages = ref<ChatMessage[]>([
  { role: 'agent', text: 'Ready when you are.' },
])
const compose = ref('')
const panel = ref<{ focus(): void } | null>(null)

function queue() {
  const t = compose.value.trim()
  if (!t) return
  messages.value.push({ role: 'you', text: t, queued: true })
  compose.value = ''
}

function send() {
  const reqs = messages.value.filter((m) => m.role === 'you' && m.queued)
  if (!reqs.length) return
  reqs.forEach((m) => (m.queued = false))
  messages.value.push({ role: 'sys', text: 'Sent ' + reqs.length + ' request(s) — exported as request.json.' })
}

function applyReply() {
  // a real host reads a dropped reply file here; the gallery fakes the round trip
  messages.value.push({ role: 'agent', text: 'Done — see the diff.' })
}`,
  },
]

export const GROUPS: Group[] = ['Controls', 'Forms', 'Visualization']

export const byGroup = (g: Group) => COMPONENTS.filter((c) => c.group === g)
export const metaOf = (id: string) => COMPONENTS.find((c) => c.id === id)!
