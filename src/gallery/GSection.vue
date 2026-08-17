<script setup lang="ts">
/* Section shell for one component: heading, import line, live demo, state readout, and a
 * tabbed source/API panel. Every section has the same shape so the gallery reads as one
 * document rather than eight ad-hoc pages.
 *
 * The tabs are the kit's own Seg component. The gallery is built out of the thing it
 * documents on purpose — if Seg broke, this page would visibly break with it. */
import { computed, ref } from 'vue'
import Seg from '@/controls/vue/Seg.vue'
import type { SegOption } from '@/controls/core/types'
import type { CompMeta } from './meta'

const props = defineProps<{
  meta: CompMeta
  /* The example's own source, handed in via Vite's `?raw`. The Template and Script tabs are SLICED
   * OUT OF IT, so the code on screen is literally the file that rendered the demo above it and
   * the two cannot drift.
   *
   * They did drift, which is why this exists: Seg's demo grew two pill instances and Transport's a
   * second bar while both Templates still showed one, and Chip's Script listed five options while
   * the demo rendered seven. Any pair of hand-maintained twins ends up here eventually.
   *
   * REQUIRED, with no meta fallback: the fallback was the last place a stale copy could hide, and
   * `meta` no longer carries example code at all. A new section without a source is now a
   * type error rather than a section whose code panel silently renders nothing. */
  source: string
}>()

/* ONE LINE PER COMPONENT, because this block has a copy button and therefore has to be real code.
 * It was `import ${name} from '${subpath}'` over the raw fields, which is valid for the sections
 * that document one component and nonsense for the ones that document several: the Fields section
 * emitted
 *     import TextField · NumberField · Select · Slider from '@aether/ui-kit/controls/text-field · …'
 * — a middot is not an import list, and there is no single specifier for four paths. Someone copied
 * it, which is the whole point of the button. Sections carrying several components now list their
 * own imports; the rest keep deriving one from name + subpath. */
const importLine = computed(() =>
  (props.meta.imports ?? [{ name: props.meta.name, subpath: props.meta.subpath }])
    .map((i) => `import ${i.name} from '${i.subpath}'`)
    .join('\n'),
)

/* The panel's one-line contents summary. `emit` and `slot` are irregular only in that they need an
   -s when there is more than one; spelling that out beats hand-writing four v-ifs in the template. */
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const summaryMeta = computed(() =>
  [
    'template',
    'script',
    plural(props.meta.props.length, 'prop'),
    /* Optional like slots and exposed. Every component emitted something until Badge, which is a
       static span and emits nothing — an unguarded `.length` here took the whole gallery down. */
    ...(props.meta.emits?.length ? [plural(props.meta.emits.length, 'emit')] : []),
    ...(props.meta.slots?.length ? [plural(props.meta.slots.length, 'slot')] : []),
    ...(props.meta.exposed?.length ? [`${props.meta.exposed.length} exposed`] : []),
  ].join(' · '),
)

/* Slice an SFC into its two blocks. Deliberately dumb string work rather than a parser: the input
 * is our own example files, and a regex that silently half-matches is worse than one that returns
 * nothing, so each slice falls back to the meta value if the markers are not found. */
function sliceBlock(src: string, tag: 'script' | 'template'): string | null {
  const open = tag === 'script' ? src.indexOf('>', src.indexOf('<script')) : src.indexOf('<template>')
  if (open < 0) return null
  const start = tag === 'script' ? open + 1 : open + '<template>'.length
  // last closer, because a template may itself contain <template #slot> children
  const end = src.lastIndexOf(`</${tag}>`)
  if (end < start) return null
  return src
    .slice(start, end)
    .replace(/^\n+|\s+$/g, '')
    .replace(/^ {2}/gm, '') // examples are indented inside their block; unindent for display
}

/* If a slice ever returns null the markers moved, and saying so beats rendering an empty panel
 * that looks like a component with no example. */
const MISSING = '/* could not read this block out of the example file */'
const shownScript = computed(() => sliceBlock(props.source, 'script') ?? MISSING)
const shownTemplate = computed(() => sliceBlock(props.source, 'template') ?? MISSING)

/* one copy handler for every code block on the section, keyed by which block was copied,
 * so two buttons can't both claim success */
const copiedKey = ref<string | null>(null)
let copyT: ReturnType<typeof setTimeout> | undefined
async function copy(key: string, text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
  } catch {
    // clipboard is blocked on insecure origins — don't flash a success that didn't happen
    copiedKey.value = null
  }
  clearTimeout(copyT)
  copyT = setTimeout(() => (copiedKey.value = null), 1400)
}

type Tab = 'template' | 'script' | 'props' | 'emits' | 'slots' | 'exposed'
const tab = ref<Tab>('template')
const tabs = computed<SegOption<Tab>[]>(() => {
  const t: SegOption<Tab>[] = [
    { value: 'template', label: 'Template' },
    { value: 'script', label: 'Script' },
    { value: 'props', label: `Props ${props.meta.props.length}` },
  ]
  // only the components that expose anything get the tab
  if (props.meta.emits?.length) {
    t.push({ value: 'emits', label: `Emits ${props.meta.emits.length}` })
  }
  if (props.meta.slots?.length) {
    t.push({ value: 'slots', label: `Slots ${props.meta.slots.length}` })
  }
  if (props.meta.exposed?.length) {
    t.push({ value: 'exposed', label: `Exposed ${props.meta.exposed.length}` })
  }
  return t
})
</script>

<template>
  <section :id="meta.id" class="g-sec">
    <div class="g-sec__head">
      <h3>{{ meta.name }}</h3>
      <code class="g-sec__path">{{ meta.subpath.replace('@aether/ui-kit/', '') }}</code>
      <span v-if="meta.core" class="g-badge" title="has a framework-free core module">core</span>
    </div>

    <p class="g-sec__blurb">{{ meta.blurb }}</p>
    <p v-if="meta.detail" class="g-sec__detail">{{ meta.detail }}</p>

    <div class="g-import">
      <!-- pre, not code: a section documenting several components emits several lines, and the
           newlines have to survive as newlines or the copy button hands over one run-on line. -->
      <pre class="g-import__code">{{ importLine }}</pre>
      <button class="g-copy" type="button" @click="copy('import', importLine)">
        {{ copiedKey === 'import' ? 'copied' : 'copy' }}
      </button>
    </div>

    <div class="g-demo">
      <slot />
    </div>

    <code v-if="$slots.state" class="g-state"><slot name="state" /></code>

    <!-- Source + API, COLLAPSED by default. Eleven sections each holding an always-open code
         panel is why the gallery could not be surveyed without scrolling past every example's
         source to reach the next component. The detail is one click away, and the trigger states
         what is inside so collapsing does not hide that it exists.

         A native <details>/<summary> rather than a hand-rolled toggle: it is open/closed without
         any state of ours, it is keyboard- and screen-reader-correct for free, and Ctrl+F still
         finds text inside a closed one in Chrome. `open` is not bound to a ref, so each section
         remembers its own state without this component tracking eleven booleans. -->
    <details class="g-panel">
      <summary class="g-panel__summary">
        <span class="g-panel__summary-label">Source &amp; API</span>
        <!-- Counted and pluralised, because "1 emits · 1 slots" is the kind of thing that makes a
             reference page look unmaintained even when every number in it is right. -->
        <span class="g-panel__summary-meta">{{ summaryMeta }}</span>
      </summary>

      <div class="g-panel__bar">
        <Seg
          :options="tabs"
          :model-value="tab"
          aria-label="Source and API"
          @update:model-value="tab = $event"
        />
        <button
          v-if="tab === 'template' || tab === 'script'"
          class="g-copy"
          type="button"
          @click="copy(tab, tab === 'template' ? shownTemplate : shownScript)"
        >
          {{ copiedKey === tab ? 'copied' : 'copy' }}
        </button>
      </div>

      <pre v-if="tab === 'template'" class="g-code"><code>{{ shownTemplate }}</code></pre>
      <pre v-else-if="tab === 'script'" class="g-code"><code>{{ shownScript }}</code></pre>

      <table v-else-if="tab === 'props'" class="g-table">
        <thead>
          <tr><th>Prop</th><th>Type</th><th>Notes</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in meta.props" :key="p.name">
            <td><code>{{ p.name }}</code></td>
            <td><code class="g-type">{{ p.type }}</code></td>
            <td>{{ p.note || '' }}</td>
          </tr>
        </tbody>
      </table>

      <table v-else-if="tab === 'emits'" class="g-table">
        <thead>
          <tr><th>Emit</th><th>Payload</th><th>Notes</th></tr>
        </thead>
        <tbody>
          <tr v-for="e in meta.emits" :key="e.name">
            <td><code>{{ e.name }}</code></td>
            <td><code class="g-type">{{ e.type }}</code></td>
            <td>{{ e.note || '' }}</td>
          </tr>
        </tbody>
      </table>

      <table v-else-if="tab === 'slots'" class="g-table">
        <thead>
          <tr><th>Slot</th><th>Scope</th><th>Notes</th></tr>
        </thead>
        <tbody>
          <tr v-for="sl in meta.slots" :key="sl.name">
            <td><code>{{ sl.name }}</code></td>
            <td><code class="g-type">{{ sl.type }}</code></td>
            <td>{{ sl.note || '' }}</td>
          </tr>
        </tbody>
      </table>

      <table v-else class="g-table">
        <thead>
          <tr><th>Via template ref</th><th>Type</th><th>Notes</th></tr>
        </thead>
        <tbody>
          <tr v-for="x in meta.exposed" :key="x.name">
            <td><code>{{ x.name }}</code></td>
            <td><code class="g-type">{{ x.type }}</code></td>
            <td>{{ x.note || '' }}</td>
          </tr>
        </tbody>
      </table>

      <p v-if="meta.core" class="g-corenote">
        Framework-free core: <code>{{ meta.core }}</code> — plain TypeScript, no Vue import. The
        component above is a thin wrapper over it.
      </p>
    </details>
  </section>
</template>

<style scoped>
.g-sec {
  border-top: 1px solid var(--aether-line);
  padding: 30px 0 34px;
  scroll-margin-top: 76px;
}
.g-sec__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.g-sec__head h3 {
  font-family: var(--g-display);
  font-size: 21px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
}
.g-sec__path {
  font-family: var(--g-mono);
  font-size: 12px;
  color: var(--aether-cool);
}
.g-badge {
  font-family: var(--g-mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--aether-line-strong);
  color: var(--aether-ink-soft);
}
.g-sec__blurb {
  margin: 8px 0 0;
  font-size: 14.5px;
  color: var(--aether-ink);
}
.g-sec__detail {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--aether-ink-soft);
  max-width: 68ch;
}

.g-import {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0 0;
}
.g-import__code {
  font-family: var(--g-mono);
  font-size: 12px;
  background: var(--g-code);
  border: 1px solid var(--aether-line);
  padding: 6px 10px;
  border-radius: 6px;
  overflow-x: auto;
  /* `pre` so several imports stay several lines. `nowrap` still holds per line — a path should
     scroll rather than fold — but the block must be free to be taller than one row, so the flex
     parent stops centring it against a button that is now shorter than it. */
  white-space: pre;
  margin: 0;
  /* `normal` gave 16px at 12px type — a 1.33 ratio, which is fine for the single line this block
     used to be and cramped the moment it became several. Code needs more leading than prose, not
     less: the eye tracks a line by its indentation, and stacked import paths are near-identical
     strings that have to be told apart at a glance. */
  line-height: 1.7;
}
.g-import {
  align-items: flex-start;
}
.g-copy {
  font-family: var(--g-mono);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--aether-line-strong);
  background: transparent;
  color: var(--aether-ink-soft);
  cursor: pointer;
  flex: none;
}
.g-copy:hover {
  color: var(--aether-ink);
  border-color: var(--aether-cool);
}

/* The demo sits on the component surface so it reads as the kit's own space,
   distinct from the page behind it. Wide demos (Gantt) scroll inside here rather
   than pushing the page sideways. */
.g-demo {
  margin-top: 16px;
  padding: 18px;
  border: 1px solid var(--aether-line);
  border-radius: 10px;
  background: var(--aether-surface);
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  overflow-x: auto;
}
.g-state {
  display: block;
  margin-top: 10px;
  font-family: var(--g-mono);
  font-size: 11.5px;
  color: var(--aether-ink-soft);
}

.g-panel {
  margin-top: 16px;
  border: 1px solid var(--aether-line-strong);
  border-radius: 10px;
  overflow: hidden;
}
/* The collapsed trigger. It has to read as a control, since the whole point is that a reader
   realises there is more here -- the version of this that was a borderless caption went unclicked. */
.g-panel__summary {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 11px 12px;
  background: var(--g-code);
  cursor: pointer;
  user-select: none;
  /* the default triangle is replaced below with one that follows the palette */
  list-style: none;
}
.g-panel__summary::-webkit-details-marker {
  display: none;
}
/* Our own marker, so it takes a token instead of the UA's black triangle -- the same reason the
   date field needed its segments styled. Rotates when open. */
.g-panel__summary::before {
  content: '';
  flex: none;
  width: 0;
  height: 0;
  border-left: 5px solid currentColor;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  color: var(--aether-ink-soft);
  transition: transform 0.15s;
}
.g-panel[open] > .g-panel__summary::before {
  transform: rotate(90deg);
}
.g-panel__summary:hover {
  color: var(--aether-ink);
}
.g-panel__summary:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: -2px;
}
.g-panel__summary-label {
  font-family: var(--g-mono);
  font-size: 11.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
}
/* Names what is inside, so collapsing hides the detail without hiding that it exists. */
.g-panel__summary-meta {
  font-family: var(--g-mono);
  font-size: 11px;
  color: var(--aether-faint);
}
/* The tab bar keeps its own top border once it is no longer the panel's first child. */
.g-panel[open] > .g-panel__bar {
  border-top: 1px solid var(--aether-line);
}
.g-panel__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: var(--g-code);
  border-bottom: 1px solid var(--aether-line);
  flex-wrap: wrap;
}
.g-code {
  margin: 0;
  padding: 14px 16px;
  overflow-x: auto;
  background: var(--aether-surface);
}
.g-code code {
  font-family: var(--g-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  color: var(--aether-ink);
}
.g-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--aether-surface);
}
.g-table th {
  text-align: left;
  font-family: var(--g-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
  font-weight: 500;
  padding: 10px 14px 8px;
  border-bottom: 1px solid var(--aether-line);
}
.g-table td {
  border-top: 1px solid var(--aether-line);
  padding: 8px 14px;
  font-size: 13px;
  vertical-align: top;
  color: var(--aether-ink-soft);
}
.g-table td:first-child {
  width: 1%;
  white-space: nowrap;
}
.g-table td code {
  font-family: var(--g-mono);
  font-size: 12px;
  color: var(--aether-ink);
}
.g-table td code.g-type {
  color: var(--aether-cool);
}
.g-corenote {
  font-size: 12.5px;
  color: var(--aether-ink-soft);
  margin: 0;
  padding: 12px 14px;
  border-top: 1px solid var(--aether-line);
  background: var(--aether-surface);
}
.g-corenote code {
  font-family: var(--g-mono);
  font-size: 11.5px;
}
</style>
