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

const props = defineProps<{ meta: CompMeta }>()

const importLine = `import ${props.meta.name} from '${props.meta.subpath}'`

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

type Tab = 'template' | 'script' | 'props' | 'emits' | 'exposed'
const tab = ref<Tab>('template')
const tabs = computed<SegOption<Tab>[]>(() => {
  const t: SegOption<Tab>[] = [
    { value: 'template', label: 'Template' },
    { value: 'script', label: 'Script' },
    { value: 'props', label: `Props ${props.meta.props.length}` },
    { value: 'emits', label: `Emits ${props.meta.emits.length}` },
  ]
  // only the components that expose anything get the tab
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
      <code>{{ importLine }}</code>
      <button class="g-copy" type="button" @click="copy('import', importLine)">
        {{ copiedKey === 'import' ? 'copied' : 'copy' }}
      </button>
    </div>

    <div class="g-demo">
      <slot />
    </div>

    <code v-if="$slots.state" class="g-state"><slot name="state" /></code>

    <!-- Source + API. A bordered panel with real tabs, because the old version was a
         borderless text toggle that read as a caption and nobody would think to click. -->
    <div class="g-panel">
      <div class="g-panel__bar">
        <Seg :options="tabs" :model-value="tab" aria-label="Source and API" @change="tab = $event" />
        <button
          v-if="tab === 'template' || tab === 'script'"
          class="g-copy"
          type="button"
          @click="copy(tab, tab === 'template' ? meta.template : meta.script)"
        >
          {{ copiedKey === tab ? 'copied' : 'copy' }}
        </button>
      </div>

      <pre v-if="tab === 'template'" class="g-code"><code>{{ meta.template }}</code></pre>
      <pre v-else-if="tab === 'script'" class="g-code"><code>{{ meta.script }}</code></pre>

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
    </div>
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
.g-import code {
  font-family: var(--g-mono);
  font-size: 12px;
  background: var(--g-code);
  border: 1px solid var(--aether-line);
  padding: 6px 10px;
  border-radius: 6px;
  overflow-x: auto;
  white-space: nowrap;
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
