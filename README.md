<div align="center">

# @aether/ui-kit

**Component cores for engineering interfaces**: the mechanics in plain TypeScript, with a thin Vue wrapper on top.

[![Gallery](https://img.shields.io/badge/gallery-live-2F6F6B?style=flat-square)](https://aethereng.github.io/aether-ui-kit/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square)](LICENSE)
[![Runtime deps](https://img.shields.io/badge/runtime%20deps-0-A9591B?style=flat-square)](package.json)
[![Deploy gallery](https://github.com/aethereng/aether-ui-kit/actions/workflows/deploy-gallery.yml/badge.svg)](https://github.com/aethereng/aether-ui-kit/actions/workflows/deploy-gallery.yml)

### → **[See the components, live](https://aethereng.github.io/aether-ui-kit/)** ←

</div>

---

Built at [Aether Engineering](https://aethereng.com) for our own tools, and **extracted from them** rather than designed in advance. It is open because the problems it solves are not proprietary: a Gantt that emits day indices instead of dates, a transport that refuses to let two writers touch one playhead, a filter rail whose grouping is data.

**Status: `0.x`.** Every component here ships in a working application, but the API still moves and this has not been through an external review. Pin a tag.

---

## The shape

The components that carry real logic are two pieces:

```
src/viz/core/gantt.ts     ← layout maths. No Vue, no DOM. Unit-tested directly.
src/viz/vue/Gantt.vue     ← renders it, emits deltas. 162 lines of template.
```

The core knows how to stack overlapping bars into lanes. It does not know what a bar *means*, what a colour encodes, or what happens on drop. That split is why the cores are testable without a browser.

**How far that goes varies by component, and it is worth being straight about it:**

| | framework-free core | in the Vue wrapper |
|---|---|---|
| **Gantt**, **Graph2D** | real algorithms: lane packing, span/point classification, force layout, projections | rendering, pointer handling, CSS |
| **PropertyEditor**, **Transport** | field coercion and validation; the scrub handoff and speed ladder | rendering |
| **Seg**, **Chip**, **Tool**, **FilterRail** | types and a couple of predicates | essentially all of it |
| **SearchField**, **Toast** | none | all of it, because the logic *is* a watcher and a timer |
| **ChatPanel** | `chat.ts`: the message union, the `{{scope:path}}` reference grammar, the bare-numeral rule | rendering, the live region and the scroll rules |

So for `Gantt` and `Graph2D`, a wrapper for another framework genuinely would be a new file importing the same core; that claim is load-bearing, and the gallery already drives `ForceLayout` directly, without the component, to prove the core stands alone. For the small controls it would be a rewrite: there is just not much to rewrite.

Two things travel further than the components do. The cores are **exported separately** (listed under [Components](#components)), so the maths is usable from React, Svelte or nothing at all without pulling Vue in. And **`ui-kit.css` is framework-agnostic**: every `.aether-*` class and the whole token contract below is plain CSS.

Today, Vue is the only wrapper that exists.

The same discipline runs through the props. Components are **controlled**: the caller owns the state, the component renders it and emits what changed. `Gantt` never mutates an item. `Transport` never advances the clock. `Graph2D` never decides where a node lives. `Toast` does not own its own message.

**Zero runtime dependencies.** Vue is a peer dependency; nothing else is a runtime dependency.

---

## Install

Not on a public registry. Depend on it by git ref, pinned to a tag:

```json
{
  "dependencies": {
    "@aether/ui-kit": "github:aethereng/aether-ui-kit#v0.24.1"
  }
}
```

Tags are immutable. A published tag is never re-pointed at a different commit; if a release turns
out to be wrong, the next patch tag supersedes it. That is the guarantee your lockfile rests on:
the commit it resolved keeps meaning what it meant. (v0.9.0 was moved once, on 2026-08-15, before
this was written down. v0.9.1 is the same tree under a name that has not moved.)

The package ships raw `.vue` and `.ts`: your bundler compiles it, same as any source dependency.

**A bundler is required.**
There is deliberately no Node-importable entry point: no `main`, and every `exports` subpath
points at `.vue`, `.ts` or `.css`, none of which Node can load. `require('@aether/ui-kit')` will not
work and is not meant to. `scripts/check-exports.mjs` holds the decision rather than leaving it as folklore. It resolves and builds every subpath through a real Vite build against the packed
tarball, and it *fails* on a subpath pointing at a `.js` file rather than letting it inherit the
exemption from the `.vue` targets beside it. Such a target is one a consumer could reasonably
`require()`, with nothing having ever executed this package under Node.

With Vite, keep it out of the pre-bundler so the Vue plugin sees it:

```ts
// vite.config.ts
optimizeDeps: { exclude: ['@aether/ui-kit'] }
```

---

## The token contract

Read this part. It is the one thing that bites people.

Kit components never hardcode a colour. They read `--aether-*` custom properties, and the package ships a **fallback** palette on `:root` so an unstyled consumer still sees something sensible. Your app overrides those tokens to make the components wear your skin:

```ts
import '@aether/ui-kit/styles'   // 1. the kit's CSS + its fallback palette
import './tokens.css'            // 2. YOUR --aether-* values
```

**The order is load-bearing.** Both files define the same properties on `:root`, so they have equal specificity and the *last one wins*. Import them the other way round and the kit's light palette silently overrides your dark theme: components render light-on-dark and nothing errors.

A host bridging onto an existing design system maps token to token:

```css
:root {
  --aether-surface: rgb(var(--v-theme-surface));
  --aether-ink:     rgb(var(--v-theme-on-surface));
  --aether-cool:    rgb(var(--v-theme-secondary));
}
```

That is the whole theming story. There is no theme provider, no runtime, no build step. A CI test asserts every token the CSS *reads* is also *defined*, and that no component hardcodes a hex outside the fallback block, which means this contract cannot quietly rot.

---

These tokens exist so a host can express something the kit could not otherwise say:

| token | default | why it exists |
|---|---|---|
| `--aether-radius-surface` | `8px` | the SURFACE radius: `Card`, `Disclosure`. Split from `--aether-radius`, which is the CONTROL radius for chips, buttons and fields: a host retuning its controls should not silently reshape its panels. Both were a literal `8px` in two components before this existed, so they agreed by luck and neither could be tuned. |
| `--aether-selected` | `var(--aether-cool)` | the SELECTED state, split from the accent. One token used to drive both a component's accent and the active state of Seg/Chip, so a host wanting those on different brand colours could not express it. Defaults to the accent, so ignoring it changes nothing. |
| `--aether-selected-wash` | `var(--aether-cool-wash)` | the tinted form of the above |
| `--aether-control-font-size` | `12.5px` | control typography. Hardcoded until a host on a 14px type scale found its kit controls sitting visibly smaller beside its own lists, fixable only by overriding the class. |
| `--aether-ok` | `#3f6b3a` | the affirmative tone. Not `--aether-cool`, which is what `--aether-selected` derives from: a success marker in the selection colour makes "this passed" and "this is selected" the same pixels. |

### Two tokens that need a value per theme

`--aether-warm`, `--aether-rose` and `--aether-ok` are the filled Badge tones, and
`--aether-warm-ink` is the text painted on them. Both sides have to move together per theme.

**Set `--aether-warm-ink` explicitly for each theme. Do not wire it to a framework's automatic
"on-primary" colour.** Those are derived from the *light* accent and typically resolve to `#fff`
everywhere, which is correct on a dark accent and wrong on a luminous one. Measured on a real
consumer, a dark theme that way gave 2.91, 2.74 and 3.50 against a 4.5 floor.

**A theme that inverts any tone must invert all of them.** A tone left at its light-theme value
fails silently: the other three still look right, so nothing on screen says which one is wrong.

## Overlays: there is no portal

`Tooltip`, `Menu` and `Dialog` all need to escape whatever is clipping them: a panel with
`overflow: hidden`, a transformed ancestor, a stacking context. None of them uses a portal, a
Teleport, or an overlay container.

They use the browser's **top layer**: `popover` for Tooltip and Menu, `showModal()` for Dialog.
The top layer sits outside every ancestor's `overflow`, `clip`, `transform` and stacking context.
Measured inside this kit's own `Disclosure`, whose body clips by design: a 260px surface positioned
the old way showed **0 of 260px**; the same surface in the top layer showed **260 of 260px**.

Placement is CSS anchor positioning: `anchor-name` on the trigger, `position-anchor` and
`position-try-fallbacks` on the surface; so the browser tracks the anchor through scroll and
resize itself and flips it when there is no room. There is no measuring loop and no resize listener
to leak.

Where the platform is missing, the components degrade rather than throw: no `popover` means the
surface falls back to a class for visibility, no anchor positioning means a one-shot rect
calculation, and no `showModal` means a non-modal dialog. All three paths are covered by tests,
because that is the path a consumer's own test suite takes; jsdom has none of these APIs.

## Where a component's CSS lives

New components ship their CSS in the component's own `<style scoped>`. `src/styles/ui-kit.css` is for
the token palette and the older global-class components only.

This is a size rule, not a taste one. `ui-kit.css` is imported **wholesale** by every consumer: it
is one file behind a single `@aether/ui-kit/styles` entry, so it cannot be tree-shaken. A consumer
importing one component today pays for every rule in it, including components it will never render.
Scoped CSS travels with the component and disappears when the component is not imported.

Transport, Disclosure, DateField and Tree follow this. Seg, Chip, Tool and PropertyEditor predate it
and still live in the global sheet; they are not worth moving, but nothing new should join them.

The exception is genuinely shared machinery (the tokens themselves, the coarse-pointer floor, the
focus ring), which every component needs and no component owns.

## Components

| | Import | What it is |
|---|---|---|
| **Seg** | `controls/seg` | One-active segmented selector. `variant="pill"` for the rounded, uppercase form. |
| **Chip** | `controls/chip` | Toggle chips with counts and colour dots. Multi-select via a `Set`. |
| **Tool** | `controls/tool` | Header action button: neutral, primary, destructive. A closed variant set, not a style hook. |
| **Tree** | `controls/tree` | A keyboard-complete tree: roving focus, typeahead, and both asymmetric arrows: Right expands a closed node but steps into an open one, Left closes an open one but steps out of a closed one. Flat-rendered with aria-level/setsize/posinset. |
| **Disclosure** | `controls/disclosure` | A collapsible panel whose header row can hold its own controls: a link or badge stays reachable while the panel is shut. Brings its own picker-free chrome; not a <details>, because a <summary> hides everything after it when closed. |
| **FilterRail** | `controls/filter-rail` | Groups of toggle chips with clear-all and a hidden-count readout. Vertical sidebar or horizontal bar. |
| **Badge** | `controls/badge` | Static status marker in four tones. A `<span>`; if it is clickable it is a `Chip`. |
| **DateField** | `controls/date-field` | A date input with the kit's own picker. Keeps the native input for typing and the OS wheel on touch; replaces only the desktop popup, which cannot be themed. |
| **RadioGroup** | `controls/radio-group` | One choice out of a few, as buttons. A `role="radiogroup"` for a VALUE; if choosing swaps a panel it is a `Seg`. Arrows wrap and select; one tab stop. |
| **Card** | `controls/card` | A panel surface: bordered, padded, holds content. Static: a clickable card is a different component. Padding and radius match `Disclosure`, which consumers stack it beside. |
| **Legend** | `viz/legend` | What the colour on a drawing means for one field: a ramp from `stops` with the `ticks` the app has formatted, or the app's own sentence for a field that is zero or has no finite range. |
| **Overlay** | `controls/overlay` | A full-page card for work the app must wait on, shown through the deferred flag: a title, what is being worked on, a bar that sweeps or fills to `progress`, a line of detail, and a stop button. `aside` takes it away at once. |
| **Gallery** | `controls/gallery` | Sample cards in one section per family: a picture, a title, a line, a foot and a note. Emits `open` with the item's id. The page around it stays the app's. |
| **Spinner** | `controls/spinner` | Indeterminate busy indicator. `label` names it for a screen reader; omit it when text beside it already says what is happening. |
| **Icon** | `controls/icon` | An icon from an SVG path string on a 24 by 24 grid, the form `@mdi/js` exports; the app keeps the icon set. 1em unless `size` says otherwise; `label` names it, and without one it is hidden from a screen reader. |
| **Tooltip** | `controls/tooltip` | Hover/focus tooltip that escapes any ancestor clipping it, via the top layer. |
| **Menu** | `controls/menu` | Dropdown menu with the full APG keyboard model. |
| **Dialog** | `controls/dialog` | Modal dialog over the native `<dialog>` element. |
| **SearchField** | `controls/search-field` | Search input whose clear button appears only once there is something to clear. |
| **ChatPanel** | `controls/chat-panel` | Message log + compose box for the queue → send → apply-reply agent pattern. Owns the log; you own what Send *does*. `actions="assistant"` switches to Send and Stop over a log that also holds streaming text, reference chips, tool calls, refusals, proposals and cards. `refScopes` sets the reference scopes the chips read. A proposal row may carry a `basis`, which adds a column; a proposal may be `destructive`, and `later` lets a superseded, discarded or accepted card be taken up again, emitting `accept` or `load-again`. |
| **Toast** | `controls/toast` | Transient status pill that fades itself out. Controlled: you own the message. |
| **Transport** | `controls/transport` | Playback transport: play/pause/replay, scrub, speed, precompute progress. Unit-agnostic: drives simulation seconds or calendar days. |
| **Switch** | `controls/switch` | Boolean toggle as a pill switch. One bare input; you own the label. |
| **TextField** | `controls/text-field` | Free text, single- or multi-line via `multiline`. `autogrow` tracks content instead of a fixed row count, live. |
| **NumberField** | `controls/number-field` | A typed number with its unit inside the box. Never rewrites a value you are still typing. |
| **Select** | `controls/select` | Native single-choice dropdown, themed via `appearance: base-select`. Supports `groups`. |
| **Slider** | `controls/slider` | A dragged number with a read-out. `format` maps the stored value to what is shown, and feeds `aria-valuetext`. `ticks` marks values the scale does not make obvious; the kit draws the track and thumb so the marks land exactly. |
| **PropertyEditor** | `property-editor` | Schema-driven form. Bind a `FieldDescriptor[]`, get an editor. Composes the standalone controls. |
| **RecordField** | `records/field` | One field of a record, in the control its `FieldView` takes (`records/core`). Gives its value when it is left or Enter is pressed. |
| **RecordTable** | `records/table` | The records of one kind as a table, a column per field (`records/core`). A cell's value goes to its row, or to every row ticked, when it is left or Enter is pressed; lines pasted go one to a row. |
| **Graph2D** | `viz/graph` | Force-directed graph over SVG. Opt-in zoom/pan/pinch, hover reporting, edge-pan while dragging. Positions are `number[]`, so the core is dimension-agnostic. |
| **Gantt** | `viz/gantt` | Lanes, spans, points and anchors in day-index space. Drag to move, edges to resize. |

All under `@aether/ui-kit/…`. Framework-free cores, importable on their own: `controls/core`, `property-editor/core`, `viz/core`, `viz/core/gantt`, `assistant/core`, `records/core`, `theme/core`.

`verbs` is framework-free too, and has no Vue part at all: see [Verbs](#verbs-the-edit-layer-under-an-editor) below.

There is also one plain CSS class, `.aether-button-group`, for a joined row of `Tool`s. It is not a component because nothing in it is ever *active*: a row of commands only looks like a `Seg`, and bending `Seg`'s `modelValue` contract to hold three unrelated actions would make it lie about what it is.

### PropertyEditor: where the labels sit

`labelPlacement` is `'above'` (default) or `'inside'`, set on the component rather than per field.

`'above'` is a property **sheet**: labels align down the left, values down the right, and a long
list scans well. `'inside'` puts a small permanent label in the control's own box, for **form**
surfaces: a dialog that already scrolls, where each field should read as one object. On the
gallery's eleven-field example, `'inside'` takes a text field from 50px to 39px and the whole form
from 616px to 541px.

`'inside'` moves the label on the five field types that have a box of their own. The other five
have no border to sit inside, and their labels stay exactly where `'above'` puts them:

| label moves inside | unchanged |
|---|---|
| `text` · `textarea` · `number` · `date` · `select` | `range` (a track and a read-out) · `boolean` (a pill switch) · `enum` with `variant: 'buttons'` (a button group) · `reference` and `placement` (**you** supply the widget through a slot) |

The label is permanent, not animated: it does not rest in the value's place and rise on focus.
`placeholder` is a real `FieldDescriptor` field, and the CSS-only floating behaviour needs
`placeholder=" "`. That value would break any caller that sets a real one.

`'inside'` changes no markup. The label is positioned, not re-parented, so overrides written against
the field structure keep matching in both modes.

### A component, in full

```vue
<script setup lang="ts">
import Gantt from '@aether/ui-kit/viz/gantt'
import { computePPD } from '@aether/ui-kit/viz/core/gantt'

// the caller owns the data; Gantt emits day-index deltas and never touches a date
function reschedule(id: string, start: number, end: number | null) {
  const item = items.value.find((i) => i.id === id)!
  item.start = start
  if (end !== null) item.end = end
}
</script>

<template>
  <Gantt
    :items="items"
    :lanes="lanes"
    :ppd="computePPD(view, scrollWidth, ndays)"
    :ndays="ndays"
    :current-day="today"
    @drag-start="snapshotForUndo()"
    @move="reschedule"
    @drag-end="persist()"
  />
</template>
```

`dragStart` fires once before the first `move`, `dragEnd` once when the gesture ends; so a host gets exactly two hooks for an undo checkpoint and a save, rather than one per pixel.

---

## Verbs: the edit layer under an editor

`verbs` is plain TypeScript with no Vue and no DOM. An app declares its vocabulary in a registry: the kinds of entity it
stores (each with the prefix its ids start with and the places it holds references to other entities), the verbs that
change them, the systems that react inside the same batch, and the reads. Every change then goes through a store.

```ts
import { createRegistry, createStore } from '@aether/ui-kit/verbs'

const registry = createRegistry({ actors: ['person', 'script'] })
registry.kind('note', { prefix: 'n' })
registry.verb<{ text: string }>({
  name: 'note.add',
  target: 'note',
  mints: true, // the store names the new note: n1, n2, …
  input: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
  apply: (draft, input, context) => draft.add('note', context.id!, { Text: input.text }),
  describe: (input) => `Add a note '${input.text}'`,
})

const store = createStore(registry)
store.run([{ verb: 'note.add', input: { text: 'first' } }], { actor: 'person' }) // { ok: true, … }
store.undo('person')
```

What the store does with a batch of calls:

- It checks each call's input against the verb's JSON Schema, then against the verb's own validation, and refuses the
  whole batch with a reason and the number of the call that refused.
- It applies the batch to an overlay and commits it as one step, or commits nothing. Listeners are told the records of
  what changed, filtered by kind and component.
- It keeps a log. `undo` and `redo` walk the steps, and a saved log (`save`, `replay`) reaches the same content hash and
  the same id counters, or is refused with the reason.
- A batch can wait as a proposal: `preview` computes what it would change without touching the store, and `accept`
  commits it later, refusing it when the store moved under it unless the caller acknowledges that.
- A gesture (a drag) runs as moves that readers see at once and that commit as one step.

**Actors** name who makes a call. `createRegistry({ actors })` takes the app's names (`['person']` when none are given).
A verb may be open to some of them only, a call by an actor the registry does not hold is refused, and undo and redo
are open to the first actor only. `preview` and `accept` run as the actor the caller names; they have no default.
A saved log names the actor of each entry, so it replays only against a registry that holds every one of them: an
entry by any other actor is refused at replay, with the actor named.

**Ids** hold none of `[ ] { } ~` and no whitespace, do not start with `#`, and may hold a dot, so a path reads one
inside brackets: `beam[C15x33.9].Size`. The name of a kind, its prefix and its group hold no dot.

`toCallSchema` gives a verb's input schema as a caller outside the app is given it: wherever the schema marks a
reference (`x-ref`), the value may also be `{ handle }`, the name an earlier call of the same proposal gave the entity
it creates. The content hash is SHA-256, computed inside the module, so the kit still has no runtime dependency.

---

## Records: the rules of a record editor

`records/core` is plain TypeScript, like `verbs`. An app declares each kind of record once, as a `KindDecl`: its fields in
display order, each a `FieldDecl` with the JSON Schema of its value (`x-ref` names the kind a reference points into),
its words, the quantity its numbers measure, its group and its control; and, for a kind whose records take one of
several shapes, the `tag` that tells them apart, the `common` fields every variant takes, and each `Variant`'s own
fields, required fields, references and quantities. Numbers are shown and read through the app's `Units`.

```ts
import { formFields, tableColumns, valueFor, type KindDecl } from '@aether/ui-kit/records/core'
```

From a declaration the core gives:

- the schemas a kind's verbs check against: `fieldsSchema` for an update's set, `createSchema` for a create's record,
  `withoutCleared`, where a null given for an optional field clears it unless its schema stores null;
- the form: `formFields` (the fields a variant takes, each in its control, a choice of another record offering the ids
  the app holds), `groupFields`, `keepOnVariant` (what a draft keeps when its variant changes) and `issueField` (the field
  a verb's refusal names);
- the table: `tableColumns`, `takesField`, `quantityOf`, the column widths (`numberWidth`, `choiceWidth`, `textWidth`,
  `isCut`), and the cell rules `cellText`, `valueFor`, `cellChange` and `pasteRows`, where a change to several rows goes
  to every row or to none, and a field declared `readonly` takes none;
- beside the store: `deleteClosure` (every record a delete must take with it, from the app's delete plan), `stepWords`
  (the words of each step undo and redo walk) and `draftKeeper` (drafts a form leaves unapplied, dropped with their
  record).

A field whose control is the app's own is declared `control: 'app'`: `formFields` gives it the kind `app`, and the app's
form draws it. The verbs a change calls stay the app's.

`records/field` is `RecordField.vue`, one field of a form. It takes a `field` (a `FieldView` from `formFields`), the
`value` the record holds, the app's `units`, an `issue` to show beside it, and for a `summary` field the app's line of what
the value holds. It emits `commit` with the value when the field is left or Enter is pressed, and only where the value
differs from the record's; `invalid` with the words for text it cannot read; and `open` with the id a choice of another
record links to. `flush` gives what is typed and not yet given, for a form's Enter and its button for a draft. A number is
typed in the unit shown and given as the record stores it. A field declared `readonly` is shown and gives nothing. A field
of `control: 'app'` draws nothing, its label and its `issue` included: the app draws its control in that place, with the
field's label and any refusal of its value beside it.

`records/table` is `RecordTable.vue`, the records of one kind as a table. It takes the `kind`, its `rows` (every record,
those the `query` hides among them), the app's `units`, `optionsOf` (the values a choice column offers), whether it is
`editable`, the `openId` of the row the app has open, the `empty` words for a table with no row shown, and `run`: a
function that takes the values a change gives a field, one per row, and answers null where it took them all, or the row
and the words of its refusal. A cell's value is given when the cell is left or Enter is pressed, and Escape puts the cell
back as the record holds it. A change in a ticked row goes to every ticked row, and lines pasted into a cell go one to a
row from there down, each as one `run`; where a change cannot go to every row, nothing runs and the reason is shown
beside the cell. It emits `open` with the id of a row whose id is clicked, and `changed` with the column, the values and
whether they were pasted, for the words of the app's step. `ticked` is a `v-model` the app may hold. A free-text column
is edited in its cells unless the app sets `textEdited` to false, which shows it as text. The table has no name of its
own: the app names the region it sits in, a section with an `aria-label` for example. The head (which kind
is shown, the counts) and what a change calls stay the app's. The table paints its fixed head and first columns in
`--aether-record-table-ground`, the surface unless the app sets it to another colour the table sits on.

---

## Small parts: a busy flag, a popover's close, the theme

`controls/composables` holds two Vue composables, each over a framework-free core in `controls/core`.

- `useDeferredFlag(source, { showDelayMs, minVisibleMs })` gives a flag for the eye from a raw one ("a save is
  running"): it shows only once the source has been up `showDelayMs`, so quick work never flashes a spinner, and once
  shown it stays up at least `minVisibleMs`. Its core is `deferredFlag(onChange, options)`, which holds the defaults.
- `useDismiss(open, root, trigger, options)` closes a popover the way a menu closes: on Escape, which hands focus back to
  `trigger`, or on a press outside `root`, which holds both the popover and its control. By default the popover takes
  Escape first, in the capture phase, and marks it used, so a handler under it that reads `defaultPrevented` can skip the press;
  and an input method composing text keeps its Escape. `{ first: false }` reads Escape after the page's own handlers,
  unmarked; `{ keepComposition: false }` closes on a composing Escape too. Its core is `bindDismiss(window, target,
  options)`, which gives back the call that unbinds it.

`theme/core` puts an app's palette on the page. `createThemeController({ themes, dark, light, storageKey, prefix, paper })`
writes each theme's colours as `--<prefix>-<role>` custom properties holding comma-separated triples (`18,24,38`, read as
`rgb(var(--app-surface))` or `rgba(var(--app-surface), 0.7)`) under one selector, `[data-theme='<name>']`, and sets
`data-theme` on the document root. Called at module scope, it does this before anything mounts. The reader's choice is
kept under `storageKey`, and without one the page follows the OS. With `paper` (the default), the document wears the light
theme while it prints and the reader's theme after; `paper: false` prints in the reader's theme. The controller is read
through `name`, `isDark` and `colors`, turned by `toggle`, and heard through `subscribe`. Where storage is blocked it follows
the OS and keeps the choice for the page. `dispose` takes off its print listeners and subscribers, for a controller replaced by a
hot reload. `theme/refs` gives a Vue app the same state as refs: `themeRefs(controller)`, callable at module scope beside it.
`hexToTriple` and `cssTokens` are exported too. The palettes stay the app's, and so does the stylesheet that maps the kit's `--aether-*` tokens onto them.

---

## A legend, a busy overlay, a gallery of samples

Each takes plain data, and the app says how it looks where its look differs from the default. Each part's inner elements carry
`aether-legend__*`, `aether-overlay__*` or `aether-gallery__*` classes, which an app's own rule can name under a class of its own.

- `viz/legend` is one field. `stops` is the colour list the drawing itself colours from, and `ticks` are text the app has
  formatted, so a value reads on the bar as it reads elsewhere. `state` is `ramp`, `zero` or `nonfinite`: the last two draw no bar,
  since neither has a range to show, and `note` is the sentence in its place, in the app's words. `noValueColor` and `noValueKey`
  explain a colour the ramp cannot place. A panel around it, and the words for a field still on its way, stay the app's.
- `controls/overlay` shows through `useDeferredFlag`, so `open` is the raw flag. `aside` takes it away at once, for the moment what
  it covers becomes the thing to watch. `progress` is a fraction from 0 to 1, for work that can report one; without it the bar sweeps.
  `stoppable`, `stopLabel` and `stopDanger` set the button, and the `mark` slot takes one decorative figure, such as a logo or a
  `Spinner`. A theme sets `--aether-overlay-scrim`, `--aether-overlay-scrim-filter`, `--aether-overlay-shadow`,
  `--aether-overlay-comet-glow` and `--aether-overlay-mark-glow-low` and `-high`; `--aether-overlay-card-end` and
  `--aether-overlay-stop-gap` are its two spaces, and `--aether-font-display` is the title's face.
  It is not a modal: Tab still reaches the page behind it, and there is no focus trap, scroll lock or Escape, so an app that must
  block its page makes its own content inert while this shows. It is `position: fixed` and outside the top layer, so it goes where
  no ancestor sets a transform, a filter or `contain`.
- `controls/gallery` takes `families` and `items`, and emits `open` with an item's id. An item has a `picture`, already the address
  for the theme in force, or an `icon` path in its place, with `foot` and `footIcon` at the card's foot and a `note` beside its
  button. The picture stands on `--aether-gallery-ground`. The page around it stays the app's: its head, whether it scrolls as a page
  or as a layer, what closes it, and any way in that is not a sample.

---

## Gallery

### **[aethereng.github.io/aether-ui-kit](https://aethereng.github.io/aether-ui-kit/)**

The components, live, each with its props, emits, exposed methods, and a copyable worked example including its data. `Icon`, `RecordField` and `RecordTable` are not on it yet. Deploys when a version tag is pushed, or by hand from the Actions tab.

Or run it locally:

```bash
npm install
npm run dev
```

The gallery is also the kit's own proof. It is a **host app**: it defines the `--aether-*` tokens itself and flips them at runtime, so if theming were broken the page would show it. It drives `ForceLayout` directly, without the Vue component, to demonstrate that the cores stand alone.

---

## Testing

```bash
npm run test:unit    # vitest
npm run type-check   # vue-tsc
npm run lint
npm run build        # type-check + build the gallery
```

**Use the Node in `.nvmrc` (24+).** The dev toolchain needs it: jsdom 30 wants
`^22.22.2 || ^24.15.0 || >=26.0.0` and undici 8 wants `>=22.19.0`. On an older Node,
`npm ci` merely *warns* and the suite then dies inside undici with
`webidl.util.markAsUncloneable is not a function`, which names neither Node nor jsdom and
reads convincingly like a broken test. This is a *development* requirement only: the package
itself has zero runtime dependencies, so there is deliberately no `engines` field gating
consumers on a Node they do not need.

The tests are in three layers that exist for different reasons:

- **Cores**: lane packing, span-vs-point classification, force-layout convergence, the scrub handoff, speed cycling, field coercion, and the verb store's batches, undo, proposals and replay. No DOM. This is where the logic lives, so this is where most tests live.
- **The package contract**: that every `exports` subpath resolves to a file that exists *and* is inside the published `files` globs; that runtime dependencies stay at zero; that the token contract holds. Both classes of bug here have shipped once: an entry point that 404s for anyone installing normally, and CSS reading tokens no palette defined.
- **Wrapper / pointer layer**: real `pointerdown`/`move`/`up` sequences against rendered DOM. This layer exists because that is where these components have actually broken: an extraction renamed a class, every hit-test selector silently stopped matching, and drag, resize and create were all dead while everything still compiled and type-checked.

### What earns a place here

A component is extracted when it has **two real consumers**, not two that look alike. Before extracting, we check the candidates share a render paradigm, a data shape, *and* an interaction contract. Several plausible-looking candidates have been rejected on exactly that test, and one was rejected twice. Where two consumers genuinely differ along one axis, that axis becomes a prop (`FilterRail`'s `orientation`, `Transport`'s `speedMode`, `Seg`'s `variant`, `ChatPanel`'s `actions`), not a second component and not an open style hook.

---

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
