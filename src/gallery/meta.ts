/* Gallery metadata — the single source for section titles, import lines, API tables, and the
 * worked example shown under each demo.
 *
 * Every prop and emit below is transcribed from the component's own defineProps/defineEmits.
 * If a signature changes and this file does not, the gallery is lying — so treat this as part
 * of the component contract, not documentation about it.
 *
 * This file holds NO example code. Each section's Template and Script tabs are sliced at runtime
 * out of the example file that renders its demo (src/gallery/examples/), so what is on screen is
 * always the code that ran. There used to be `template` and `script` strings here as a second
 * copy, and they had drifted in 8 of 10 sections before being deleted -- a hand-maintained twin
 * of a live demo is a stale twin. Do not reintroduce them.
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
  /* Slots were the gap: four components take one and the API tables documented none of them, so a
     reader could see every prop a component accepts and still not know it could hold an icon. */
  slots?: ApiRow[]
  /** Methods and refs reachable through a template ref, for the components that expose any. */
  exposed?: ApiRow[]
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
      { name: 'modelValue', type: 'V | null', note: 'null = nothing matches; no option is active' },
      { name: 'ariaLabel', type: 'string?', note: 'labels the group for screen readers' },
      { name: 'variant', type: "'default' | 'pill'?", note: 'toolbar control vs mono capsule header' },
    ],
    emits: [
      { name: 'update:modelValue', type: '[value: V]', note: 'v-model' },
      {
        name: 'change',
        type: '[value: V]',
        note: 'same value, for non-v-model callers. BOTH events fire on every selection, update:modelValue first — so v-model + @change together is redundant, and the @change handler runs after the model is already written',
      },
    ],
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
        note: '{ value, label, count?, dotColor?, swatch?, color?, muted?, disabled?, title? }',
      },
      { name: 'modelValue', type: 'V | Set<V>', note: 'single value or a Set for multi-select' },
      { name: 'variant', type: "'pill' | 'row'?", note: 'inline filter chip vs sidebar list row' },
      { name: 'ariaLabel', type: 'string?' },
    ],
    emits: [{ name: 'toggle', type: '[value: V]', note: 'caller owns the Set; chip only reports' }],
  },
  {
    id: 'tool',
    name: 'Tool',
    subpath: '@aether/ui-kit/controls/tool',
    group: 'Controls',
    blurb: 'Header action button, in three variants: neutral, primary, destructive.',
    detail:
      'A closed variant set rather than an open style hook. If both hot and danger are passed, danger wins — mislabelling a destructive action as primary is the worse failure. There is deliberately no active/pressed state: Tool is a stateless command, which is the line between it and Seg. A control where several things can be on at once is Chip\'s contract, not this one.',
    props: [
      { name: 'label', type: 'string', note: 'also the accessible name when the label is hidden' },
      { name: 'hot', type: 'boolean?', note: 'the primary action on a surface' },
      { name: 'danger', type: 'boolean?', note: 'destructive — delete, discard' },
      { name: 'disabled', type: 'boolean?' },
      { name: 'title', type: 'string?', note: 'native tooltip' },
      { name: 'labelHidden', type: 'boolean?', note: 'icon only; ignored without an #icon slot' },
    ],
    slots: [
      {
        name: 'icon',
        type: '—',
        note: 'leading icon; the caller brings its own SVG. A slot rather than an `icon` prop because a prop implies an icon vocabulary and the kit ships none — @mdi/js path strings drop straight in',
      },
    ],
    emits: [{ name: 'click', type: '[]' }],
  },
  {
    id: 'tree',
    name: 'Tree',
    subpath: '@aether/ui-kit/controls/tree',
    group: 'Controls',
    core: '@aether/ui-kit/controls/core',
    blurb: 'A keyboard-complete tree: roving focus, both asymmetric arrows, typeahead.',
    detail:
      'Controlled — the caller owns `expanded` and `selected`, both plain data, so a host can persist or restore them. Rendered flat rather than as nested lists: ARIA allows it once each row carries aria-level/setsize/posinset, and flat keeps the roving tabindex to one list and leaves room for virtualisation later. The whole keyboard model lives in the framework-free core (`treeKey`), because it is the part that gets written wrong: Right expands a closed node but steps INTO an open one, and Left closes an open node but steps OUT of a closed one — implementations routinely ship only one half of each. Moving is not selecting: arrowing never fires `select`, so walking a file tree does not open a file per keypress.',
    props: [
      { name: 'nodes', type: 'TreeNode<T>[]', note: 'id, label, optional children and free-form data' },
      { name: 'expanded', type: 'string[]?', note: 'open node ids; the caller owns them' },
      { name: 'selected', type: 'string | null?' },
      { name: 'ariaLabel', type: 'string?', note: 'names the tree for a screen reader' },
      { name: 'indent', type: 'number?', note: 'px per level, default 14' },
    ],
    emits: [
      { name: 'update:expanded', type: '[string[]]' },
      { name: 'select', type: '[id: string, node: TreeNode<T>]', note: 'click, Enter or Space' },
    ],
    slots: [
      {
        name: 'row',
        type: '{ row: TreeRow<T> }',
        note: 'replace a row’s content — badges, counts, icons. Anything focusable in here breaks the roving tabindex, so controls belong outside the tree',
      },
    ],
  },
  {
    id: 'disclosure',
    name: 'Disclosure',
    subpath: '@aether/ui-kit/controls/disclosure',
    group: 'Controls',
    blurb: 'A collapsible panel whose header row can hold its own controls.',
    detail:
      'Controlled: the caller owns `open` and binds `v-model:open`, so open-state can be keyed by row and persisted. Deliberately not a <details>/<summary>, which would have given the keyboard and screen-reader contract for free — but everything after a <summary> is hidden while the panel is closed, so a header control cannot stay reachable there, and nesting it inside the summary flattens it in the accessibility tree. That is what the #aside slot is for, and why this owns its header row. Collapsed content still uses hidden="until-found", so find-in-page reaches it and the resulting beforematch becomes update:open.',
    props: [
      { name: 'label', type: 'string', note: 'header text, and the toggle’s accessible name' },
      { name: 'open', type: 'boolean?', note: 'controlled by the caller; the panel never self-toggles' },
      { name: 'meta', type: 'string?', note: 'quieter second line — a filename, a count, what is inside' },
      { name: 'disabled', type: 'boolean?', note: 'the toggle emits nothing' },
    ],
    emits: [{ name: 'update:open', type: '[boolean]', note: 'also fired by find-in-page reveal' }],
    slots: [
      { name: 'default', type: '—', note: 'the collapsible region' },
      {
        name: 'aside',
        type: '—',
        note: 'header controls that stay reachable while COLLAPSED — a link, a menu, a badge. Rendered as a sibling of the toggle, never inside it, so each is its own tab stop',
      },
    ],
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
    slots: [
      {
        name: 'play',
        type: '{ playing: boolean; atEnd: boolean }',
        note: 'replaces the ▶/❚❚/⟲ glyph. Scoped, so the caller renders the right icon for the state without tracking it',
      },
      { name: 'stop', type: '—', note: 'replaces the ✕ glyph' },
    ],
  },
  {
    id: 'property-editor',
    name: 'PropertyEditor',
    subpath: '@aether/ui-kit/property-editor',
    group: 'Forms',
    core: '@aether/ui-kit/property-editor/core',
    blurb: 'Schema-driven form: bind a FieldDescriptor[], get an editor.',
    detail:
      'Text, textarea, number, date, boolean, and enum (button-group or dropdown) fields. The core is plain TypeScript with unit tests and no DOM; the Vue file is a thin wrapper. It stays ignorant of what the object being edited actually is. A number field takes step/min/max/precision and a `suffix` rendered after the input — the kit renders a unit, it never knows one, so conversion and unit systems stay with the caller. `reference` and `placement` render through a named slot instead: only the caller knows how to pick an entity or edit a 3D placement.',
    props: [
      { name: 'fields', type: 'FieldDescriptor[]', note: '{ key, label, type, options?, … }' },
      { name: 'modelValue', type: 'FieldValues', note: 'a plain record' },
    ],
    emits: [
      { name: 'update:modelValue', type: '[values: FieldValues]' },
      { name: 'change', type: '[key: string, value: unknown]', note: 'per-field, for undo hooks' },
    ],
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
      {
        name: 'mapping',
        type: "'fit' | 'direct'?",
        note: "default 'fit', which refits every frame; 'direct' draws 1:1 so a drag tracks the cursor",
      },
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
      {
        name: 'weekLabels',
        type: '{ day: number; label: string }[]?',
        note: 'captions down the spine; the demo passes these',
      },
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
      {
        name: 'expandDay',
        type: '[day: { t: string; i: number } | null]',
        note: 'many one-day items on the same date; null closes the expansion',
      },
    ],
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
  },
  {
    id: 'toast',
    name: 'Toast',
    subpath: '@aether/ui-kit/controls/toast',
    group: 'Controls',
    blurb: 'Transient status pill that fades itself out.',
    detail:
      'Controlled, like the rest of the kit: the caller owns the message, and the component clears it by emitting an update rather than holding its own visibility, so a host can dismiss early by setting the model to an empty string. Not a queue and not a notification centre: a second message while one is up replaces it and restarts the timer, which is what all three original hosts already did and what you want for "Copied", "Queued", "Saved". Extracted after those three shipped it byte-identically; the tell was that they had already merged their CSS into one shared rule keyed off three different ids, leaving only the four lines of timer logic copied per host.',
    props: [
      { name: 'modelValue', type: 'string', note: 'the message; empty string = hidden' },
      { name: 'duration', type: 'number?', note: 'ms before it clears itself; default 1700' },
    ],
    emits: [
      {
        name: 'update:modelValue',
        type: '[value: string]',
        note: "emits '' when the timer expires, so the caller's state stays authoritative",
      },
    ],
  },
]

export const GROUPS: Group[] = ['Controls', 'Forms', 'Visualization']

export const byGroup = (g: Group) => COMPONENTS.filter((c) => c.group === g)
export const metaOf = (id: string) => COMPONENTS.find((c) => c.id === id)!
