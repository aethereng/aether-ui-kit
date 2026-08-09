<script setup lang="ts">
/* Section shell for one component: heading, import line, live demo, state readout,
 * usage snippet and the generated API tables. Every section has the same shape so the
 * gallery reads as one document rather than eight ad-hoc pages. */
import { ref } from 'vue'
import type { CompMeta } from './meta'

const props = defineProps<{ meta: CompMeta }>()

const copied = ref(false)
let copyT: ReturnType<typeof setTimeout> | undefined
const importLine = `import ${props.meta.name} from '${props.meta.subpath}'`

async function copyImport() {
  try {
    await navigator.clipboard.writeText(importLine)
    copied.value = true
  } catch {
    // clipboard is blocked in some contexts (file://, insecure origin) — say so rather
    // than flashing a success state that did not happen
    copied.value = false
  }
  clearTimeout(copyT)
  copyT = setTimeout(() => (copied.value = false), 1400)
}

const showApi = ref(false)
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
      <button class="g-copy" type="button" @click="copyImport">
        {{ copied ? 'copied' : 'copy' }}
      </button>
    </div>

    <div class="g-demo">
      <slot />
    </div>

    <code v-if="$slots.state" class="g-state"><slot name="state" /></code>

    <button class="g-apitoggle" type="button" :aria-expanded="showApi" @click="showApi = !showApi">
      {{ showApi ? '▾' : '▸' }} API — {{ meta.props.length }} props · {{ meta.emits.length }} emits
    </button>

    <div v-if="showApi" class="g-api">
      <pre class="g-usage"><code>{{ meta.usage }}</code></pre>

      <table>
        <caption>
          Props
        </caption>
        <tbody>
          <tr v-for="p in meta.props" :key="p.name">
            <td><code>{{ p.name }}</code></td>
            <td><code class="g-type">{{ p.type }}</code></td>
            <td>{{ p.note || '' }}</td>
          </tr>
        </tbody>
      </table>

      <table>
        <caption>
          Emits
        </caption>
        <tbody>
          <tr v-for="e in meta.emits" :key="e.name">
            <td><code>{{ e.name }}</code></td>
            <td><code class="g-type">{{ e.type }}</code></td>
            <td>{{ e.note || '' }}</td>
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

.g-apitoggle {
  margin-top: 14px;
  font-family: var(--g-mono);
  font-size: 11px;
  letter-spacing: 0.05em;
  background: transparent;
  border: 0;
  padding: 4px 0;
  color: var(--aether-cool);
  cursor: pointer;
}
.g-apitoggle:hover {
  text-decoration: underline;
}

.g-api {
  margin-top: 10px;
}
.g-usage {
  margin: 0 0 14px;
  padding: 12px 14px;
  background: var(--g-code);
  border: 1px solid var(--aether-line);
  border-radius: 8px;
  overflow-x: auto;
}
.g-usage code {
  font-family: var(--g-mono);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre;
}
.g-api table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 14px;
}
.g-api caption {
  text-align: left;
  font-family: var(--g-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
  padding-bottom: 6px;
}
.g-api td {
  border-top: 1px solid var(--aether-line);
  padding: 6px 10px 6px 0;
  font-size: 13px;
  vertical-align: top;
  color: var(--aether-ink-soft);
}
.g-api td:first-child {
  width: 1%;
  white-space: nowrap;
}
.g-api td code {
  font-family: var(--g-mono);
  font-size: 12px;
  color: var(--aether-ink);
}
.g-api td code.g-type {
  color: var(--aether-cool);
}
.g-corenote {
  font-size: 12.5px;
  color: var(--aether-ink-soft);
  margin: 0;
}
.g-corenote code {
  font-family: var(--g-mono);
  font-size: 11.5px;
}
</style>
