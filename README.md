<div align="center">

# @aether/ui-kit

**Component cores for engineering interfaces** — the mechanics in plain TypeScript, a thin Vue wrapper on top.

[![Gallery](https://img.shields.io/badge/gallery-live-2F6F6B?style=flat-square)](https://aethereng.github.io/aether-ui-kit/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square)](LICENSE)
[![Runtime deps](https://img.shields.io/badge/runtime%20deps-0-A9591B?style=flat-square)](package.json)
[![Tests](https://img.shields.io/badge/tests-175-2F6F6B?style=flat-square)](#testing)
[![Deploy gallery](https://github.com/aethereng/aether-ui-kit/actions/workflows/deploy-gallery.yml/badge.svg)](https://github.com/aethereng/aether-ui-kit/actions/workflows/deploy-gallery.yml)

### → **[See every component, live](https://aethereng.github.io/aether-ui-kit/)** ←

</div>

---

Built at [Aether Engineering](https://aethereng.com) for our own tools, and **extracted from them** rather than designed in advance. It is open because the problems it solves are not proprietary — a Gantt that emits day indices instead of dates, a transport that refuses to let two writers touch one playhead, a filter rail whose grouping is data.

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
| **Gantt**, **Graph2D** | real algorithms — lane packing, span/point classification, force layout, projections | rendering, pointer handling, CSS |
| **PropertyEditor**, **Transport** | field coercion and validation; the scrub handoff and speed ladder | rendering |
| **Seg**, **Chip**, **Tool**, **FilterRail** | types and a couple of predicates | essentially all of it |
| **SearchField**, **Toast**, **ChatPanel** | none | all of it — the logic *is* a watcher and a timer |

So for `Gantt` and `Graph2D`, a wrapper for another framework genuinely would be a new file importing the same core; that claim is load-bearing, and the gallery already drives `ForceLayout` directly, without the component, to prove the core stands alone. For the small controls it would be a rewrite — there is just not much to rewrite.

Two things travel further than the components do. The cores are **exported separately** (`viz/core`, `viz/core/gantt`, `controls/core`, `property-editor/core`), so the maths is usable from React, Svelte or nothing at all without pulling Vue in. And **`ui-kit.css` is framework-agnostic** — every `.aether-*` class and the whole token contract below is plain CSS.

Today, Vue is the only wrapper that exists.

The same discipline runs through the props. Components are **controlled**: the caller owns the state, the component renders it and emits what changed. `Gantt` never mutates an item. `Transport` never advances the clock. `Graph2D` never decides where a node lives. `Toast` does not own its own message.

**Zero runtime dependencies.** Vue is a peer dependency, nothing else is anything.

---

## Install

Not on a public registry. Depend on it by git ref, pinned to a tag:

```json
{
  "dependencies": {
    "@aether/ui-kit": "github:aethereng/aether-ui-kit#v0.11.0"
  }
}
```

Tags are immutable. A published tag is never re-pointed at a different commit — if a release turns
out to be wrong, the next patch tag supersedes it. That is the guarantee your lockfile rests on:
the commit it resolved keeps meaning what it meant. (v0.9.0 was moved once, on 2026-08-15, before
this was written down. v0.9.1 is the same tree under a name that has not moved.)

The package ships raw `.vue` and `.ts` — your bundler compiles it, same as any source dependency. With Vite, keep it out of the pre-bundler so the Vue plugin sees it:

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

**The order is load-bearing.** Both files define the same properties on `:root`, so they have equal specificity and the *last one wins*. Import them the other way round and the kit's light palette silently overrides your dark theme — components render light-on-dark and nothing errors.

A host bridging onto an existing design system maps token to token:

```css
:root {
  --aether-surface: rgb(var(--v-theme-surface));
  --aether-ink:     rgb(var(--v-theme-on-surface));
  --aether-cool:    rgb(var(--v-theme-secondary));
}
```

That is the whole theming story. There is no theme provider, no runtime, no build step. A CI test asserts every token the CSS *reads* is also *defined*, and that no component hardcodes a hex outside the fallback block — so this contract cannot quietly rot.

---

Three tokens exist so a host can express something the kit could not otherwise say:

| token | default | why it exists |
|---|---|---|
| `--aether-selected` | `var(--aether-cool)` | the SELECTED state, split from the accent. One token used to drive both a component's accent and the active state of Seg/Chip, so a host wanting those on different brand colours could not express it. Defaults to the accent, so ignoring it changes nothing. |
| `--aether-selected-wash` | `var(--aether-cool-wash)` | the tinted form of the above |
| `--aether-control-font-size` | `12.5px` | control typography. Hardcoded until a host on a 14px type scale found its kit controls sitting visibly smaller beside its own lists, fixable only by overriding the class. |

## Where a component's CSS lives

New components ship their CSS in the component's own `<style scoped>`. `src/styles/ui-kit.css` is for
the token palette and the older global-class components only.

This is a size rule, not a taste one. `ui-kit.css` is imported **wholesale** by every consumer — it
is one file behind a single `@aether/ui-kit/styles` entry, so it cannot be tree-shaken. A consumer
importing one component today pays for every rule in it, including components it will never render.
Scoped CSS travels with the component and disappears when the component is not imported.

Transport, Disclosure, DateField and Tree follow this. Seg, Chip, Tool and PropertyEditor predate it
and still live in the global sheet; they are not worth moving, but nothing new should join them.

The exception is genuinely shared machinery — the tokens themselves, the coarse-pointer floor, the
focus ring — which every component needs and no component owns.

## Components

| | Import | What it is |
|---|---|---|
| **Seg** | `controls/seg` | One-active segmented selector. `variant="pill"` for the rounded, uppercase form. |
| **Chip** | `controls/chip` | Toggle chips with counts and colour dots. Multi-select via a `Set`. |
| **Tool** | `controls/tool` | Header action button: neutral, primary, destructive. A closed variant set, not a style hook. |
| **Tree** | `controls/tree` | A keyboard-complete tree: roving focus, typeahead, and both asymmetric arrows — Right expands a closed node but steps into an open one, Left closes an open one but steps out of a closed one. Flat-rendered with aria-level/setsize/posinset. |
| **Disclosure** | `controls/disclosure` | A collapsible panel whose header row can hold its own controls — a link or badge stays reachable while the panel is shut. Brings its own picker-free chrome; not a <details>, because a <summary> hides everything after it when closed. |
| **FilterRail** | `controls/filter-rail` | Groups of toggle chips with clear-all and a hidden-count readout. Vertical sidebar or horizontal bar. |
| **Badge** | `controls/badge` | Static status marker in four tones. A `<span>` — if it is clickable it is a `Chip`. |
| **SearchField** | `controls/search-field` | Search input whose clear button appears only once there is something to clear. |
| **ChatPanel** | `controls/chat-panel` | Message log + compose box for the queue → send → apply-reply agent pattern. Owns the log; you own what Send *does*. |
| **Toast** | `controls/toast` | Transient status pill that fades itself out. Controlled: you own the message. |
| **Transport** | `controls/transport` | Playback transport: play/pause/replay, scrub, speed, precompute progress. Unit-agnostic — drives simulation seconds or calendar days. |
| **PropertyEditor** | `property-editor` | Schema-driven form. Bind a `FieldDescriptor[]`, get an editor. |
| **Graph2D** | `viz/graph` | Force-directed graph over SVG. Opt-in zoom/pan/pinch, hover reporting, edge-pan while dragging. Positions are `number[]`, so the core is dimension-agnostic. |
| **Gantt** | `viz/gantt` | Lanes, spans, points and anchors in day-index space. Drag to move, edges to resize. |

All under `@aether/ui-kit/…`. Framework-free cores, importable on their own: `controls/core`, `property-editor/core`, `viz/core`, `viz/core/gantt`.

There is also one plain CSS class, `.aether-button-group`, for a joined row of `Tool`s. It is not a component because nothing in it is ever *active* — a row of commands only looks like a `Seg`, and bending `Seg`'s `modelValue` contract to hold three unrelated actions would make it lie about what it is.

### PropertyEditor: where the labels sit

`labelPlacement` is `'above'` (default) or `'inside'`, set on the component rather than per field.

`'above'` is a property **sheet**: labels align down the left, values down the right, and a long
list scans well. `'inside'` puts a small permanent label in the control's own box, for **form**
surfaces — a dialog that already scrolls, where each field should read as one object. On the
gallery's eleven-field example, `'inside'` takes a text field from 50px to 39px and the whole form
from 616px to 541px.

`'inside'` moves the label on the five field types that have a box of their own. The other five
have no border to sit inside, and their labels stay exactly where `'above'` puts them:

| label moves inside | unchanged |
|---|---|
| `text` · `textarea` · `number` · `date` · `select` | `range` (a track and a read-out) · `boolean` (a pill switch) · `enum` with `variant: 'buttons'` (a button group) · `reference` and `placement` (**you** supply the widget through a slot) |

The label is permanent, not animated: it does not rest in the value's place and rise on focus.
`placeholder` is a real `FieldDescriptor` field, and the CSS-only floating behaviour needs
`placeholder=" "` — which would break any caller that sets a real one.

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

`dragStart` fires once before the first `move`, `dragEnd` once when the gesture ends — so a host gets exactly two hooks for an undo checkpoint and a save, rather than one per pixel.

---

## Gallery

### **[aethereng.github.io/aether-ui-kit](https://aethereng.github.io/aether-ui-kit/)**

Every component, live, with its props, emits, exposed methods, and a copyable worked example including its data. Deploys from `main` on every push.

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

**Use the Node in `.nvmrc` (24+).** The dev toolchain needs it — jsdom 30 wants
`^22.22.2 || ^24.15.0 || >=26.0.0` and undici 8 wants `>=22.19.0`. On an older Node,
`npm ci` merely *warns* and the suite then dies inside undici with
`webidl.util.markAsUncloneable is not a function`, which names neither Node nor jsdom and
reads convincingly like a broken test. This is a *development* requirement only: the package
itself has zero runtime dependencies, so there is deliberately no `engines` field gating
consumers on a Node they do not need.

175 tests, in three layers that exist for different reasons:

- **Cores (62)** — lane packing, span-vs-point classification, force-layout convergence, the scrub handoff, speed cycling, field coercion. No DOM. This is where the logic lives, so this is where most tests live.
- **The package contract (33)** — that every `exports` subpath resolves to a file that exists *and* is inside the published `files` globs; that runtime dependencies stay at zero; that the token contract holds. Both classes of bug here have shipped once: an entry point that 404s for anyone installing normally, and CSS reading tokens no palette defined.
- **Wrapper / pointer layer (80)** — real `pointerdown`/`move`/`up` sequences against rendered DOM. This layer exists because that is where these components have actually broken: an extraction renamed a class, every hit-test selector silently stopped matching, and drag, resize and create were all dead while everything still compiled and type-checked.

### What earns a place here

A component is extracted when it has **two real consumers**, not two that look alike. Before extracting, we check the candidates share a render paradigm, a data shape, *and* an interaction contract — several plausible-looking candidates have been rejected on exactly that test, and one was rejected twice. Where two consumers genuinely differ along one axis, that axis becomes a prop (`FilterRail`'s `orientation`, `Transport`'s `speedMode`, `Seg`'s `variant`), not a second component and not an open style hook.

---

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
