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
    blurb: 'A date input with the kit\'s own picker, because the browser\'s cannot be styled.',
    detail:
      'It keeps a real `input[type="date"]` for typing — locale-ordered segments, real validation, and on a touch device tapping it still opens the OS date wheel, which beats anything drawn here. What it replaces is the DESKTOP popup, which cannot be themed at all: it is browser UI painted outside the page, not page content. Verified rather than assumed — `input.shadowRoot` is null, the only pseudo-elements Chrome exposes are the inline parts, the popup is in none of them, and `base-select` is the only `appearance: base-*` value in Chromium 148, so customizable controls shipped for select and not for date. So the native indicator is hidden and the panel is ours, and there is no popup at all on a coarse pointer where the platform\'s is better. The keyboard cursor is deliberately NOT the selection: arrowing around the calendar moves a focus ring without committing, or exploring next month would rewrite the field on the way. It was the last control reachable only by describing a form — a FieldDescriptor[], a FieldValues object and a (key, value) handler, to render one date input — which is the packaging failure v0.13.0 named for five controls and RadioGroup closed for a sixth. PropertyEditor composes it now.',
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
      'The control Seg is mistaken for. Seg is role="tablist" with role="tab" children and belongs where choosing SWAPS A PANEL; this is role="radiogroup" with role="radio" children and belongs where choosing sets a VALUE — a unit, a mode, a grade. Identical pixels, and a screen reader says whichever one you picked, so the choice between them is the only real decision here. It existed before as PropertyEditor\'s `enum` field with `variant: "buttons"`, reachable only by describing a form: a FieldDescriptor[], a FieldValues object and a (key, value) handler, to render two buttons. A consumer wrote exactly that twice in one afternoon for a units picker and an analysis-mode picker, neither of which is a form — the same packaging failure v0.13.0 fixed for the other five controls, left behind because this one had no standalone shape yet. PropertyEditor composes it now. Arrows wrap and SELECT as they move, which is the radio pattern rather than the menu\'s: the focused option is the chosen one, so there is no separate commit. Disabled options are skipped rather than landed on. The group is one tab stop, not one per option, via a roving tabindex on the checked option — or the first, when nothing is checked, since a group you cannot tab into is worse than one that starts at the top.',
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
    id: 'switch',
    name: 'Switch',
    subpath: '@aether/ui-kit/controls/switch',
    group: 'Forms',
    blurb: 'Boolean toggle as a pill switch. One bare input; you own the label.',
    detail:
      'This existed before it was a component — but only under `.aether-property-editor__field input[type=checkbox]`, so the appearance lived inside a form and a consumer with one standalone toggle had no way to reach it. That is a packaging failure rather than a missing feature, and PropertyEditor now renders this instead of a raw input. It is deliberately one `<input>` with no wrapper and no label of its own: a self-labelling wrapper would nest a `<label>` inside the form\'s own `<label for>`, which is invalid, and would change the DOM a consumer\'s overrides are written against. Extraction also gave it the kit\'s focus ring, which it had never had — ui-kit.css declares one ring "for every control the kit ships" and lists Tool, Chip, Seg and the enum buttons; the switch was missed, so keyboard focus fell through to the browser\'s own blue. There is still no coarse-pointer floor, and that is carried over deliberately: the 18px knob is tuned to a 22px track, so a min-height rule rewrites the track and leaves the knob behind.',
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
      'It commits every keystroke, which is the line between it and NumberField: a number field that did the same would rewrite the model to 1 the moment you typed "1." and never let you reach 1.5. `multiline` is a PROP rather than a second component, and that is the kit\'s rule applied consistently — a textarea types exactly like an input, with the same data, the same commit-per-keystroke and the same bordered box, so only its SHAPE differs. Different interaction means a different component; different shape means a prop. The multiline form resizes vertically only: one that could be dragged wider escapes whatever column it sits in, and in a form that column is the layout.',
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
      'Its own component for two structural reasons. COMMIT SEMANTICS: a text field commits every keystroke, and a number field that did would rewrite the model to 1 the moment you type "1.", making 1.5 unreachable. `coerceNumberInput` tells mid-typing from genuinely cleared using `validity.badInput`, which is the only signal that distinguishes them — an unparseable number input reports an EMPTY value, so without it "1." and "" are the same thing. DOM: the border lives on a WRAPPER with a borderless input inside, so the unit sits inside the box; a bordered input with a sibling span reads as two controls and makes the unit look like a caption. `precision` derives `step` when none is given (2 → 0.01) so the spinner increments sanely, without rounding what is stored or displayed.',
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
      'Native on purpose: it is the one control where the platform\'s own popup beats anything the kit could build — it renders above everything without a portal, it works on touch, and on mobile it becomes the OS picker. What native did NOT allow was theming its options, which is why `appearance: base-select` matters: it opts the control into the customizable-select rendering and the popup and its rows become ordinary styleable boxes. Behind `@supports`, so a browser without it keeps the fully native control rather than a half-built one. GROUPS ARE STRUCTURE, not decoration: a picker listing load cases AND ULS combinations flattened into one list loses the distinction between two kinds of thing, which in a structural model is a correctness problem — and `subtitle` is what lets two similarly-named rows tell themselves apart, a combination carrying its factored formula.',
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
      'NOT a variant of NumberField: a slider is a different INTERACTION for a value whose scale matters more than its digits — an opacity, a cutting plane. IT NEVER WRITES A CORRECTED VALUE BACK, which is the contract worth stating: a native range snaps its THUMB to the nearest step, so a component that read `.value` back on render would silently rewrite a stored 0.37 to 0.35 for a field nobody touched. `format` exists because a stored value and a displayed one are not always the same quantity — a 0-100 position driving a non-linear deform factor has no business printing its own number — and it feeds `aria-valuetext` too, so the announced value is "×1.0" and not "25". It draws its own track and thumb, which is not a styling preference: a tick has to land exactly under the value it marks, the thumb centre travels from thumb/2 to width−thumb/2, and a thumb rule is silently ignored unless the input is `appearance: none`, which takes the native track with it.',
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
      'Its padding and radius are Disclosure\'s own — 12px 14px, and `--aether-radius-surface` — rather than new numbers, because consumers stack the two in a single column and mismatched insets show up as content edges that do not line up. The radius is deliberately NOT `--aether-radius`, which is the CONTROL radius for chips and fields: a host retuning its controls should not silently reshape its panels. DELIBERATELY STATIC, and that is the line rather than an omission — a consumer also ships a selectable list card with a hover lift, a selected ring and a colour-coded left border, and that is a different component by the kit\'s own rule, since it differs in INTERACTION and not only in shape. A clickable card would drag click, disabled, selected and a whole keyboard contract in behind it. Padding is not a prop for the same reason it is not a token: one consumer wants dense and another roomy, which is a call-site override, the way Seg leaves stretching to the host.',
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
      'INDETERMINATE ONLY. A determinate progress ring is a different control — it carries a value, a max and an `aria-valuenow`, and answers "how far" rather than "is it working". NOT a `loading` prop on Card either, and that was checked against the real call sites rather than assumed: one sits in a Disclosure\'s header slot, which is not a Card at all, and the other sits inline beside its own status text inside a card body — "this line is working", not "this card is busy". A card-level loading state serves neither, and would make a static surface own a state it has no other reason to know. `label` IS the accessibility contract and is optional for that same measured reason: beside visible status text, naming the spinner would make a screen reader say the same thing twice in two vocabularies; alone in a panel header, staying unnamed makes the panel read as idle. No label means `aria-hidden`; a label means `role="status"`. The stroke is derived from the size and ROUNDED to a whole pixel — unrounded, size/8 gives 1.75px at size 14 and a browser floors a sub-pixel border, so one ring drew visibly thinner than its neighbour. Motion is slowed under `prefers-reduced-motion`, not stopped: a frozen spinner reads as a hung process, which is the one thing it exists to disprove.',
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
      'The line between this and Chip is interactivity, not appearance: Chip is a button with click, disabled and an emit, and a marker exposed as a button lands in the tab order doing nothing. Badge is a span. The kit maps tone to pixels and never maps a domain state to a tone — a caller with `singular` or `verified` resolves those itself, the same boundary that lets the kit render a `suffix` without knowing a unit. The three semantic tones are filled rather than tinted, and that is a contrast decision: measured tone-on-page, `--aether-warm` is 3.83 on `--aether-panel`, and a wash only pulls the background toward the text. Painting its own ground makes the ratio independent of whatever surface the badge sits on, which is also what lets one badge ship into two host palettes. Neutral stays unfilled because it is the tone that appears six-in-a-row. No icon, no count, no close, no size axis, and no group component — a row of badges has no shared state to model.',
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
      'The reason this is a component rather than a CSS sibling is clipping. Anything positioned inside a container with `overflow: hidden` — Disclosure\'s body, for one, which clips by design so its reveal can animate — is cut off at the edge: measured, a 260px surface showed 0 of 260px. The `popover` attribute puts the surface in the browser\'s TOP LAYER, outside every ancestor\'s overflow, clip, transform and stacking context, and the same surface then showed 260 of 260. There is no Teleport here and none is needed. Position comes from CSS anchor positioning, so the browser tracks the anchor through scroll and resize itself and `position-try-fallbacks` flips it when there is no room — no listeners, no measuring loop. `aria-describedby` is wired onto the trigger only when the text says something the accessible name does not, because half of real tooltips restate the label of an icon button and a description there makes a screen reader read the same words twice.',
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
      '`popover="auto"` carries the top layer AND light-dismiss, so a click outside closes it with no document listener that has to be added, removed, and taught not to fire on the opening click. The keyboard model is in controls/core/menu.ts as pure functions over plain data, for the same reason the tree\'s is: arrows wrap, disabled items and separators are skipped rather than landed on and ignored, Home/End are not optional, typing jumps by label and repeating a letter cycles through matches, Escape closes and returns focus to the trigger, and Tab closes rather than walking into the surface. Focus moves for real rather than through aria-activedescendant, which is what the APG pattern specifies and what makes Enter and Space work with no extra wiring.',
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
      'Thin on purpose. `showModal()` already gives the top layer, a real focus trap, `inert` on everything behind, Escape-to-close, `::backdrop`, and focus returned to whatever opened it — none of which is reimplemented here. What the component adds is the two things the platform leaves out: a page scroll lock that restores whatever the host had set before, and a backdrop click. That click needs a rect test rather than a target check, because a click on the backdrop lands on the <dialog> ELEMENT itself — the backdrop is its pseudo-element and has no separate hit target — so without comparing coordinates against the content box, a click on the dialog\'s own padding would read as a click outside it.',
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
      'A closed variant set rather than an open style hook. If both hot and danger are passed, danger wins — mislabelling a destructive action as primary is the worse failure. There is deliberately no active/pressed state: Tool is a stateless command, which is the line between it and Seg. A control where several things can be on at once is Chip\'s contract, not this one.',
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
      'Text, textarea, number, range, date, boolean, and enum (button-group or dropdown) fields. The core is plain TypeScript with unit tests and no DOM; the Vue file is a thin wrapper. It stays ignorant of what the object being edited actually is. A number field takes step/min/max/precision and a `suffix` rendered after the input — the kit renders a unit, it never knows one, so conversion and unit systems stay with the caller. `reference` and `placement` render through a named slot instead: only the caller knows how to pick an entity or edit a 3D placement.',
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

export const GROUPS: Group[] = ['Controls', 'Overlays', 'Forms', 'Visualization']

export const byGroup = (g: Group) => COMPONENTS.filter((c) => c.group === g)
export const metaOf = (id: string) => COMPONENTS.find((c) => c.id === id)!
