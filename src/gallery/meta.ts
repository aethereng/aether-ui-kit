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

export type Group = 'Controls' | 'Overlays' | 'Forms' | 'Visualization'

export interface ApiRow {
  name: string
  type: string
  note?: string
}

export interface CompMeta {
  id: string
  name: string
  /* ONE component per section, so this is always a real import specifier. There used to be an
     `imports` list here for sections documenting several at once — because those emitted
     `import A · B from 'x · y'`, which is not code, into a block with a copy button. The list
     fixed the symptom; one section per component removes the cause, and a reader looking for
     Select now finds a section called Select rather than a batch named after the commit that
     happened to extract four controls together. */
  subpath: string
  group: Group
  /** One line: what it is. Shown under the heading. */
  blurb: string
  /** Optional second paragraph for the pieces that need the reasoning stated. */
  detail?: string
  /** Framework-free core module, when the component has one. */
  core?: string
  props: ApiRow[]
  /** Optional: a purely presentational component (Badge) reports nothing back. */
  emits?: ApiRow[]
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
    detail:
      'A row of segments where exactly one is active. `modelValue` may be null for "nothing matches", which a preset picker over continuous state needs. `variant: \'pill\'` is a rounder, uppercase form. It announces as a tablist, so reach for it where choosing switches a view.',
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
        note: 'DEPRECATED — use update:modelValue, which carries the same value and fires first. It was added for callers with no v-model, but `:model-value` + `@change` is `@update:model-value` spelled longer, and RadioGroup ships one emit. Still fires: an emit that is removed fails silently at the call site, so it goes once the live bindings have moved',
      },
    ],
  },
  {
    id: 'date-field',
    name: 'DateField',
    subpath: '@aether/ui-kit/controls/date-field',
    group: 'Forms',
    blurb: 'A date input with its own calendar popup.',
    detail:
      'A date input with its own calendar popup. The native input stays for typing, and on touch for the OS picker; the popup replaces only the desktop one, which browsers do not let you style. Value is `YYYY-MM-DD`, or empty.',
    props: [
      { name: 'modelValue', type: 'string', note: "`YYYY-MM-DD`, or '' for empty; v-model" },
      { name: 'id', type: 'string?', note: 'reaches the inner input, so `<label for>` works' },
    ],
    emits: [{ name: 'update:modelValue', type: '[value: string]' }],
  },
  {
    id: 'radio-group',
    name: 'RadioGroup',
    subpath: '@aether/ui-kit/controls/radio-group',
    group: 'Forms',
    core: '@aether/ui-kit/controls/core',
    blurb: 'One choice out of a few, as buttons. A value — not a tab strip.',
    detail:
      'One choice out of a few, drawn as buttons. A `radiogroup`: one tab stop, arrows that move and select, disabled options skipped. Use it for a value — if choosing swaps a panel, that is a Seg.',
    props: [
      { name: 'options', type: 'RadioOption<V>[]', note: '{ value, label, disabled? }' },
      { name: 'modelValue', type: 'V', note: 'controlled; v-model' },
      { name: 'ariaLabel', type: 'string?', note: 'the group\'s accessible name' },
    ],
    emits: [
      { name: 'update:modelValue', type: '[value: V]', note: 'v-model. One emit — deliberately not Seg\'s redundant second `change`' },
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
      'Toggle buttons, for filtering. `modelValue` takes one value or a `Set` for multi-select. An option can carry a count, a colour dot or a swatch, and `muted` dims one without disabling it, so an empty facet stays visible and still clickable.',
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
    id: 'switch',
    name: 'Switch',
    subpath: '@aether/ui-kit/controls/switch',
    group: 'Forms',
    blurb: 'Boolean toggle as a pill switch. One bare input; you own the label.',
    detail:
      'A boolean, drawn as a pill switch. One bare `input[type=checkbox]` with no wrapper and no label of its own: pair it with a `<label for>` so the label can carry whatever the surface needs — a count, a swatch, a second line.',
    props: [
      { name: 'modelValue', type: 'boolean', note: 'controlled; v-model' },
      { name: 'disabled', type: 'boolean?' },
    ],
    emits: [{ name: 'update:modelValue', type: '[value: boolean]' }],
  },
  {
    id: 'text-field',
    name: 'TextField',
    subpath: '@aether/ui-kit/controls/text-field',
    group: 'Forms',
    blurb: 'Free text, single- or multi-line.',
    detail:
      'Free text. `multiline` renders a textarea instead, resizable vertically only so it cannot escape its column. Commits on every keystroke.',
    props: [
      { name: 'modelValue', type: 'string', note: 'controlled; v-model' },
      { name: 'multiline', type: 'boolean?', note: 'render a textarea instead' },
      { name: 'rows', type: 'number?', note: 'visible rows when multiline; ignored otherwise' },
      { name: 'placeholder', type: 'string?' },
      { name: 'disabled', type: 'boolean?' },
    ],
    emits: [{ name: 'update:modelValue', type: '[value: string]' }],
  },
  {
    id: 'number-field',
    name: 'NumberField',
    subpath: '@aether/ui-kit/controls/number-field',
    group: 'Forms',
    core: '@aether/ui-kit/property-editor/core',
    blurb: 'A number, with its unit inside the box. Not a `type` on TextField.',
    detail:
      'A number, with its unit inside the box. It commits only a complete value, so typing "1." leaves the model alone on the way to 1.5. Clearing emits `undefined`, which is distinct from 0. `precision` derives `step` when `step` is omitted.',
    props: [
      { name: 'modelValue', type: 'number | undefined', note: 'undefined = empty, not zero' },
      { name: 'min / max / step', type: 'number?', note: 'straight to the native input' },
      { name: 'precision', type: 'number?', note: 'decimal places; derives step when step is absent' },
      { name: 'suffix', type: 'string?', note: 'a unit the kit renders and never interprets' },
      { name: 'placeholder', type: 'string?' },
      { name: 'disabled', type: 'boolean?' },
    ],
    emits: [{ name: 'update:modelValue', type: '[value: number | undefined]' }],
  },
  {
    id: 'select',
    name: 'Select',
    subpath: '@aether/ui-kit/controls/select',
    group: 'Forms',
    core: '@aether/ui-kit/controls/core',
    blurb: 'A single-choice dropdown over a native <select>.',
    detail:
      'A single-choice dropdown over a native `<select>` — themed where the browser allows it, and the OS picker on mobile. `options` is a flat list, `groups` renders `<optgroup>`s, and a row can carry a `subtitle` as a quieter second line.',
    props: [
      { name: 'modelValue', type: 'string', note: 'controlled; v-model' },
      { name: 'options', type: 'SelectOption[]?', note: '{ value, label, subtitle?, disabled? }' },
      { name: 'groups', type: 'SelectGroup[]?', note: 'rendered as <optgroup>; combine with options' },
      { name: 'disabled', type: 'boolean?' },
    ],
    emits: [{ name: 'update:modelValue', type: '[value: string]' }],
  },
  {
    id: 'slider',
    name: 'Slider',
    subpath: '@aether/ui-kit/controls/slider',
    group: 'Forms',
    core: '@aether/ui-kit/controls/core',
    blurb: 'A number you drag rather than type, with a read-out beside it.',
    detail:
      'A number you drag, with a read-out beside it. `format` maps the stored value to what is shown and to `aria-valuetext`, so a 0–100 position can display as the quantity it means. `ticks` marks values on the track. It never writes a step-corrected value back.',
    props: [
      { name: 'modelValue', type: 'number', note: 'controlled; v-model' },
      { name: 'min / max / step', type: 'number?', note: 'straight to the native input' },
      { name: 'format', type: '(v: number) => string?', note: 'the read-out, and aria-valuetext' },
      { name: 'ticks', type: 'SliderTick[]?', note: 'marks on the track; { value, label? }' },
      { name: 'suffix', type: 'string?', note: 'a unit the kit renders and never interprets' },
      { name: 'disabled', type: 'boolean?' },
    ],
    emits: [{ name: 'update:modelValue', type: '[value: number]' }],
  },
  {
    id: 'card',
    name: 'Card',
    subpath: '@aether/ui-kit/controls/card',
    group: 'Controls',
    blurb: 'A panel surface: bordered, padded, holds content and does nothing.',
    detail:
      'A bordered, padded surface that holds content and does nothing else. Static by design — no click, no state. Override padding at the call site for a denser or roomier box.',
    props: [],
    emits: [],
  },
  {
    id: 'spinner',
    name: 'Spinner',
    subpath: '@aether/ui-kit/controls/spinner',
    group: 'Controls',
    blurb: 'An indeterminate busy indicator. Something is happening, for an unknown while.',
    detail:
      'An indeterminate busy indicator. `size` sets the diameter and the stroke follows it. `label` names it for a screen reader; omit it when text beside it already says what is happening. Motion slows under `prefers-reduced-motion` rather than stopping.',
    props: [
      { name: 'size', type: 'number?', note: 'outer diameter in px; default 16' },
      { name: 'label', type: 'string?', note: 'accessible name; omit when text beside it speaks' },
    ],
    emits: [],
  },
  {
    id: 'badge',
    name: 'Badge',
    subpath: '@aether/ui-kit/controls/badge',
    group: 'Controls',
    blurb: 'Static status marker in four tones. A span, not a control.',
    detail:
      'A static status marker in four tones. A `<span>`, not a control — if it should be clickable, that is a Chip. The kit maps a tone to pixels; deciding which tone a domain state deserves stays with the caller.',
    props: [
      {
        name: 'tone',
        type: "'neutral' | 'success' | 'warning' | 'danger'?",
        note: "default 'neutral'; host maps domain → tone",
      },
    ],
    slots: [{ name: 'default', type: 'string', note: 'the badge text; caller-supplied' }],
  },
  {
    id: 'tooltip',
    name: 'Tooltip',
    subpath: '@aether/ui-kit/controls/tooltip',
    group: 'Overlays',
    blurb: 'Hover/focus tooltip that escapes any ancestor clipping it.',
    detail:
      'Explanatory text on hover or focus. It uses the platform\'s top layer, so no ancestor\'s `overflow` or transform can clip it and there is nothing to portal. `placement` picks a side, and it flips when there is no room.',
    props: [
      { name: 'text', type: 'string', note: 'plain text; rich content is unreachable by touch' },
      { name: 'placement', type: "'top' | 'bottom' | 'left' | 'right'?", note: "default 'bottom'" },
      { name: 'delay', type: 'number?', note: 'hover dwell in ms, default 400; focus is immediate' },
      { name: 'disabled', type: 'boolean?' },
    ],
    slots: [{ name: 'default', type: '—', note: 'the trigger element' }],
  },
  {
    id: 'menu',
    name: 'Menu',
    subpath: '@aether/ui-kit/controls/menu',
    group: 'Overlays',
    core: '@aether/ui-kit/controls/core',
    blurb: 'Dropdown menu with the full APG keyboard model.',
    detail:
      'A popup list of actions. Arrows move, typing jumps, Escape closes and returns focus. Items are data — separators and disabled entries included — and the caller handles what a pick does.',
    props: [
      { name: 'items', type: 'MenuItem[]', note: '{ id, label, disabled?, separator?, data? }' },
      { name: 'label', type: 'string?', note: 'trigger text; #trigger replaces the button' },
      { name: 'placement', type: "'bottom' | 'top'?" },
      { name: 'align', type: "'start' | 'end'?", note: "which trigger edge the surface aligns to" },
    ],
    emits: [{ name: 'select', type: '[id: string]', note: 'never fires for a disabled item' }],
    slots: [
      { name: 'trigger', type: '{ open, toggle }', note: 'replaces the default button' },
      { name: 'item', type: '{ item: MenuItem }', note: 'per-row content, e.g. an icon' },
    ],
  },
  {
    id: 'dialog',
    name: 'Dialog',
    subpath: '@aether/ui-kit/controls/dialog',
    group: 'Overlays',
    blurb: 'Modal dialog over the native <dialog> element.',
    detail:
      'A modal over the page. Focus is trapped while it is open, Escape and a backdrop click close it, and focus returns to whatever opened it.',
    props: [
      { name: 'open', type: 'boolean', note: 'controlled; v-model:open' },
      { name: 'title', type: 'string?', note: 'accessible name, and the default heading' },
      { name: 'maxWidth', type: 'string?', note: "default '720px'" },
      { name: 'dismissible', type: 'boolean?', note: 'Escape + backdrop + close button; default true' },
    ],
    emits: [{ name: 'update:open', type: '[value: boolean]' }],
    slots: [
      { name: 'default', type: '—', note: 'dialog body' },
      { name: 'title', type: '—', note: 'replaces the heading' },
      { name: 'footer', type: '—', note: 'action row; omitted entirely when not supplied' },
    ],
  },
  {
    id: 'tool',
    name: 'Tool',
    subpath: '@aether/ui-kit/controls/tool',
    group: 'Controls',
    blurb: 'Header action button, in three variants: neutral, primary, destructive.',
    detail:
      'A compact toolbar button. `hot` marks the active one. It reaches the 44px touch floor on a coarse pointer without growing on a mouse.',
    props: [
      { name: 'label', type: 'string', note: 'also the accessible name when the label is hidden' },
      { name: 'hot', type: 'boolean?', note: 'the primary action on a surface' },
      { name: 'danger', type: 'boolean?', note: 'destructive — delete, discard' },
      { name: 'disabled', type: 'boolean?' },
      { name: 'title', type: 'string?', note: 'native tooltip' },
      { name: 'labelHidden', type: 'boolean?', note: 'icon only; ignored without an #icon slot' },
      {
        name: 'fill',
        type: 'boolean?',
        note: 'filled rather than outline; only meaningful with `danger`. Outline is the default because a filled red button repeated across a toolbar stops reading as a warning — raise it for the destructive action whose consequence is genuinely worse than its neighbours’',
      },
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
      'A hierarchy that expands and collapses. Rows derive from `TreeNode<T>[]` and the caller owns which nodes are open. The whole keyboard model — arrows, Home/End, typeahead — lives in the framework-free core.',
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
      'A panel that collapses. It draws its own card, so it is the surface rather than a header inside one. `open` belongs to the caller, and the `#aside` slot holds controls that stay reachable while it is closed. Find-in-page still reaches collapsed text.',
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
      'A rail of Chip rows, one per facet. The groups and their selections are data, and a toggle reports which group it came from so a host can route it without tracking positions.',
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
      'A search input with a clear button that appears once there is something to clear. Clearing returns the caret to the field. `focus()` is exposed so a host shortcut need not reach into the DOM.',
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
      'Playback controls: play and pause, a scrub bar, a speed cycle and a time read-out. Unit-agnostic — the same bar drives simulation seconds or calendar days. Scrubbing pauses and resumes around the drag, so a drag and a running clock never both write the playhead.',
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
      'A form rendered from a `FieldDescriptor[]`, which is what makes it worth using: the field set can change at runtime — a different shape, a conditional field — without a template per case. It composes the kit\'s standalone controls for each type, and coercion and validation live in a framework-free engine.',
    props: [
      { name: 'fields', type: 'FieldDescriptor[]', note: '{ key, label, type, options?, … }' },
      { name: 'modelValue', type: 'FieldValues', note: 'a plain record' },
      {
        name: 'labelPlacement',
        type: "'above' | 'inside'",
        note: "default 'above'; 'inside' only moves the five boxed types",
      },
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
      'A force-directed node graph: pan, zoom, and drag a node to place it. The layout is a framework-free core, so the maths is usable without the component.',
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
      'A timeline of bars in lanes. Drag to move, edge handles to resize, double-click a lane to create. It emits deltas in day indices and never touches dates, so the caller keeps its own calendar.',
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
      'A message log with a composer. Messages are data — a role, optional references, a queued state for anything not yet sent. Rendering only; sending is the caller\'s.',
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
      'A transient message. It dismisses itself on a timer that pauses while the pointer is over it, and the caller owns the message it shows.',
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

export const GROUPS: Group[] = ['Controls', 'Overlays', 'Forms', 'Visualization']

export const byGroup = (g: Group) => COMPONENTS.filter((c) => c.group === g)
export const metaOf = (id: string) => COMPONENTS.find((c) => c.id === id)!
