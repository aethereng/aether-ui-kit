/* Gallery metadata — the single source for section titles, import lines, and API tables.
 *
 * Every prop and emit below is transcribed from the component's own defineProps/defineEmits.
 * If a signature changes and this file does not, the gallery is lying — so treat this as part
 * of the component contract, not documentation about it.
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
  usage: string
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
    ],
    emits: [
      { name: 'update:modelValue', type: '[value: V]', note: 'v-model' },
      { name: 'change', type: '[value: V]', note: 'same value, for non-v-model callers' },
    ],
    usage: `<Seg
  :options="[{ value: 'cards', label: 'Cards' }, { value: 'graph', label: 'Graph' }]"
  :model-value="view"
  aria-label="View"
  @change="view = $event"
/>`,
  },
  {
    id: 'chip',
    name: 'Chip',
    subpath: '@aether/ui-kit/controls/chip',
    group: 'Controls',
    blurb: 'Toggle chips with an optional count and colour dot. Multi-select via a Set.',
    detail:
      'The dot colour is a caller concern — the kit never decides what a category means, only how a chip behaves. `color` accents the label itself (an option can carry its encoding without a dot); `muted` dims an option without disabling it, for a filter whose count is zero but which should still be visible and clickable.',
    props: [
      { name: 'options', type: 'ChipOption<V>[]', note: '{ value, label, count?, dotColor?, color?, muted?, disabled? }' },
      { name: 'modelValue', type: 'V | Set<V>', note: 'single value or a Set for multi-select' },
      { name: 'ariaLabel', type: 'string?' },
    ],
    emits: [{ name: 'toggle', type: '[value: V]', note: 'caller owns the Set; chip only reports' }],
    usage: `<Chip
  :options="[{ value: 'fact', label: 'Facts', count: 6 }]"
  :model-value="active"
  @toggle="toggle($event)"
/>`,
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
    usage: `<Tool label="New card" hot @click="create()" />
<Tool label="Delete" danger @click="remove()" />`,
  },
  {
    id: 'filter-rail',
    name: 'FilterRail',
    subpath: '@aether/ui-kit/controls/filter-rail',
    group: 'Controls',
    blurb: 'A labelled rail of toggle-chip groups, with clear-all and a hidden-count readout.',
    detail:
      'Grouping and selection are pure data (FilterGroup[]); the rail renders one Chip row per group and wires toggle/clear mechanically. The one component extracted after a three-surface duplication audit — the other candidates were rejected as look-alikes. Both real consumers ship: Brain Map as a vertical sidebar, Quarter Timeline as a horizontal header bar.',
    props: [
      { name: 'groups', type: 'FilterGroup<V>[]', note: '{ key, label, options, selected: Set<V> }' },
      { name: 'hiddenCount', type: 'number?', note: 'shown as "N hidden" when non-zero' },
      { name: 'clearLabel', type: 'string?', note: 'defaults to "clear"' },
      { name: 'orientation', type: "'vertical' | 'horizontal'?", note: 'sidebar rail vs header bar; default vertical' },
    ],
    emits: [
      { name: 'toggle', type: '[groupKey: string, value: V]' },
      { name: 'clear', type: '[]' },
    ],
    usage: `<FilterRail
  :groups="groups"
  :hidden-count="hidden"
  @toggle="(g, v) => toggle(g, v)"
  @clear="clearAll()"
/>`,
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
      'Pauses on scrub-start and resumes on scrub-end, so a drag and a running clock can never both write the playhead. Deliberately unit-agnostic — the same component drives simulation seconds and calendar days.',
    props: [
      { name: 'current', type: 'number', note: 'playhead position — caller owns the clock' },
      { name: 'duration', type: 'number' },
      { name: 'playing', type: 'boolean' },
      { name: 'speed', type: 'number?' },
      { name: 'speeds', type: 'number[]?', note: 'selectable presets' },
      { name: 'phase', type: "'play' | 'precompute'?", note: 'shows a progress bar while building' },
      { name: 'precomputePct', type: 'number?' },
      { name: 'format', type: '(t: number) => string?', note: 'override the readout formatting' },
    ],
    emits: [
      { name: 'toggle', type: '[]' },
      { name: 'seek', type: '[t: number]' },
      { name: 'set-speed', type: '[s: number]' },
      { name: 'stop', type: '[]' },
      { name: 'scrub-start', type: '[]' },
      { name: 'scrub-end', type: '[]' },
    ],
    usage: `<Transport
  :current="t" :duration="dur" :playing="playing"
  @toggle="togglePlay()" @seek="t = $event"
  @scrub-start="pause()" @scrub-end="resume()"
/>`,
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
    usage: `<PropertyEditor
  :fields="fields"
  :model-value="values"
  @change="(key, value) => store.mutate(key, value)"
/>`,
  },
  {
    id: 'graph2d',
    name: 'Graph2D',
    subpath: '@aether/ui-kit/viz/graph',
    group: 'Visualization',
    core: '@aether/ui-kit/viz/core',
    blurb: 'Force-directed graph over an SVG renderer.',
    detail:
      'The core is dimension-agnostic — positions are `number[]`, so axis 3 can be spatial z, axis 4 a construction sequence, axis 5 a discipline. A GL renderer would reuse the same core and change only the draw call.',
    props: [
      { name: 'nodes', type: 'GNode[]', note: '{ id, pos: number[], label?, color?, r? }' },
      { name: 'edges', type: 'GEdge[]', note: '{ a, b, w? }' },
      { name: 'width', type: 'number?' },
      { name: 'height', type: 'number?' },
      { name: 'projection', type: "'ortho2d' | 'iso3d'?", note: 'how N-D positions flatten to 2-D' },
      { name: 'running', type: 'boolean?', note: 'drive the layout externally' },
      { name: 'selection', type: 'string | null?' },
      { name: 'neighbors', type: 'Set<string> | null?', note: 'emphasise a neighbourhood' },
    ],
    emits: [
      { name: 'nodeClick', type: '[id: string]' },
      { name: 'nodeDown', type: '[id: string, x: number, y: number]' },
      { name: 'drag', type: '[id: string, x: number, y: number]' },
      { name: 'dragEnd', type: '[id: string]' },
    ],
    usage: `<Graph2D
  :nodes="nodes" :edges="edges"
  :width="560" :height="360"
  @node-click="select($event)"
/>`,
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
      { name: 'dragStart', type: '[id: string]', note: 'once, before the first move — snapshot here' },
      { name: 'move', type: '[id, start, end | null]' },
      { name: 'resize', type: "[id, edge: 'l' | 'r', value]" },
      { name: 'dragEnd', type: '[id: string]', note: 'once, when a moved gesture ends — persist here' },
      { name: 'newAt', type: '[day: number, type: string]' },
      { name: 'expandDay', type: '[day | null]', note: 'many one-day items on the same date' },
    ],
    usage: `<Gantt
  :items="items" :lanes="lanes"
  :ppd="ppd" :ndays="90" :current-day="today"
  @move="(id, s, e) => reschedule(id, s, e)"
/>`,
  },
]

export const GROUPS: Group[] = ['Controls', 'Forms', 'Visualization']

export const byGroup = (g: Group) => COMPONENTS.filter((c) => c.group === g)
export const metaOf = (id: string) => COMPONENTS.find((c) => c.id === id)!
