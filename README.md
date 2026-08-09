# @aether/ui-kit

Component cores for engineering interfaces — the mechanics in plain TypeScript, a thin Vue wrapper on top.

Built at [Aether Engineering](https://aethereng.com) for our own tools, and extracted from them rather than designed in advance. It is open because the problems it solves are not proprietary — a Gantt that emits day indices instead of dates, a transport that refuses to let two writers touch one playhead, a filter rail whose grouping is data.

**Status: `0.x`.** Every component here ships in a working application, but the API still moves and this has not been through an external review. Pin a tag.

---

## The shape

Every component is two pieces:

```
src/viz/core/gantt.ts     ← layout maths. No Vue, no DOM. Unit-tested directly.
src/viz/vue/Gantt.vue     ← renders it, emits deltas. ~200 lines of template.
```

The core knows how to stack overlapping bars into lanes. It does not know what a bar *means*, what a colour encodes, or what happens on drop. That split is why the cores are testable without a browser, and why a second framework wrapper would be a new file rather than a rewrite.

The same discipline runs through the props. Components are **controlled**: the caller owns the state, the component renders it and emits what changed. `Gantt` never mutates an item. `Transport` never advances the clock. `Graph2D` never decides where a node lives.

**Zero runtime dependencies.** Vue is a peer dependency, nothing else is anything.

---

## Install

Not on a public registry. Depend on it by git ref, pinned to a tag:

```json
{
  "dependencies": {
    "@aether/ui-kit": "github:aethereng/aether-ui-kit#v0.2.0"
  }
}
```

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

That is the whole theming story. There is no theme provider, no runtime, no build step.

---

## Components

| | Import | What it is |
|---|---|---|
| **Seg** | `@aether/ui-kit/controls/seg` | One-active segmented selector. |
| **Chip** | `@aether/ui-kit/controls/chip` | Toggle chips with counts and colour dots. Multi-select via a `Set`. |
| **Tool** | `@aether/ui-kit/controls/tool` | Header action button: neutral, primary, destructive. A closed variant set, not a style hook. |
| **FilterRail** | `@aether/ui-kit/controls/filter-rail` | Groups of toggle chips with clear-all and a hidden-count readout. Vertical sidebar or horizontal bar. |
| **Transport** | `@aether/ui-kit/controls/transport` | Playback transport: play/pause/replay, scrub, speed, precompute progress. Unit-agnostic — drives simulation seconds or calendar days. |
| **PropertyEditor** | `@aether/ui-kit/property-editor` | Schema-driven form. Bind a `FieldDescriptor[]`, get an editor. |
| **Graph2D** | `@aether/ui-kit/viz/graph` | Force-directed graph over SVG. Positions are `number[]`, so the core is dimension-agnostic. |
| **Gantt** | `@aether/ui-kit/viz/gantt` | Lanes, spans, points and anchors in day-index space. Drag to move, edges to resize. |

Framework-free cores, importable on their own: `controls/core`, `property-editor/core`, `viz/core`, `viz/core/gantt`.

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

Every component, live, with its API and a working theme switch:

```bash
npm install
npm run dev
```

The gallery is also the kit's own proof. It is a host app: it defines the `--aether-*` tokens itself and flips them at runtime, so if theming were broken the page would show it.

---

## Development

```bash
npm run test:unit    # vitest — the cores, no DOM
npm run type-check   # vue-tsc
npm run lint
npm run build        # type-check + build the gallery
```

The cores carry the tests, because they carry the logic worth testing: lane packing, span-vs-point classification, the scrub handoff, speed cycling, field coercion.

### What earns a place here

A component is extracted when it has **two real consumers**, not two that look alike. Before extracting, we check that the candidates share a render paradigm, a data shape, and an interaction contract — several plausible-looking candidates have been rejected on exactly that test. Where two consumers genuinely differ along one axis, that axis becomes a prop (`FilterRail`'s `orientation`, `Transport`'s `speedMode`), not a second component and not an open style hook.

---

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
