<script setup lang="ts">
import { ref } from 'vue'
import Seg from '@/controls/vue/Seg.vue'
import Chip from '@/controls/vue/Chip.vue'
import Tool from '@/controls/vue/Tool.vue'
import PropertyEditor from '@/property-editor/vue/PropertyEditor.vue'
import Graph2D from '@/viz/vue/Graph2D.vue'
import type { GNode, GEdge } from '@/viz/core'
import type { SegOption, ChipOption } from '@/controls/core/types'
import type { FieldDescriptor, FieldValues as PEValues } from '@/property-editor/core/types'

// ── Seg demos ──
const view = ref<'cards' | 'graph'>('cards')
const theme = ref<'paper' | 'timber'>('paper')
const segOpts: SegOption[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'graph', label: 'Graph' },
]
const themeOpts: SegOption[] = [
  { value: 'paper', label: 'Paper' },
  { value: 'timber', label: 'Timber' },
]
function setView(v: string) {
  view.value = v as 'cards' | 'graph'
}
function setTheme(v: string) {
  theme.value = v as 'paper' | 'timber'
}

// ── Chip demos (set-based multi-select) ──
const active = ref<Set<string>>(new Set(['fact', 'risk']))
const chipOpts: ChipOption[] = [
  { value: 'fact', label: 'Facts', count: 6, dotColor: 'var(--aether-cool-soft)' },
  { value: 'idea', label: 'Ideas', count: 3 },
  { value: 'risk', label: 'Risks', count: 2, dotColor: 'var(--aether-warm)' },
  { value: 'link', label: 'Links', count: 0, dotColor: 'transparent' },
]
function toggleChip(v: string) {
  const next = new Set(active.value)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  active.value = next
}

// ── Tool demos ──
const pressed = ref(0)
function bump() {
  pressed.value++
}

// ── PropertyEditor demo ──
const peFields: FieldDescriptor[] = [
  { key: 'title', label: 'Title', type: 'text', placeholder: 'Untitled' },
  { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Write…' },
  {
    key: 'kind',
    label: 'Kind',
    type: 'enum',
    variant: 'buttons',
    options: [
      { value: 'fact', label: 'Fact' },
      { value: 'idea', label: 'Idea' },
      { value: 'risk', label: 'Risk' },
    ],
  },
  { key: 'live', label: 'Live', type: 'boolean' },
]
const peValues: PEValues = { title: '', body: '', kind: 'fact', live: true }
const peOut = ref<PEValues>({ ...peValues })

// ── Graph demo (viz/graph) ──
// A small synthetic graph: two hubs with satellites. pos is seed-only; the
// force layout fills it in. The 3rd axis (pos[2]) is ready for spatial z later.
const palette = ['var(--aether-cool)', 'var(--aether-warm)', 'var(--aether-cool-soft)']
const gNodes: GNode[] = Array.from({ length: 18 }, (_, i) => ({
  id: 'n' + i,
  pos: [(Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, 0],
  label: i % 5 === 0 ? 'hub' + i : undefined,
  color: palette[i % 3],
  r: i % 5 === 0 ? 10 : 5,
}))
const gEdges: GEdge[] = []
for (let i = 1; i < gNodes.length; i++) {
  const target = i % 5 === 0 ? i : Math.floor(i / 5) * 5
  gEdges.push({ a: 'n' + target, b: 'n' + i, w: 1 })
}
const gClicked = ref<string>('—')
function onNodeClick(id: string) {
  gClicked.value = id
}
</script>

<template>
  <div class="gallery">
    <header class="g-head">
      <h1>@aether/ui-kit</h1>
      <p>Neutral, shared components — framework-free core, thin Vue wrapper. {{ 5 }} components.</p>
    </header>

    <section class="g-section">
      <h2>Seg <span>controls/seg</span></h2>
      <p class="g-note">
        One-active selector. Emits <code>update:modelValue</code> + <code>change</code>.
      </p>
      <div class="g-row">
        <Seg :options="segOpts" :model-value="view" aria-label="View" @change="setView" />
        <Seg :options="themeOpts" :model-value="theme" aria-label="Theme" @change="setTheme" />
        <Seg
          :options="[{ value: 'a', label: 'Disabled' }]"
          :model-value="'a'"
          aria-label="Locked"
        />
      </div>
      <code class="g-state">view = "{{ view }}" · theme = "{{ theme }}"</code>
    </section>

    <section class="g-section">
      <h2>Chip <span>controls/chip</span></h2>
      <p class="g-note">Toggle chip with count + dot. Multi-select via a <code>Set</code>.</p>
      <div class="g-row">
        <Chip :options="chipOpts" :model-value="active" aria-label="Filters" @toggle="toggleChip" />
      </div>
      <code class="g-state">active = [{{ [...active].join(', ') }}]</code>
    </section>

    <section class="g-section">
      <h2>Tool <span>controls/tool</span></h2>
      <p class="g-note">Header action button. <code>hot</code> marks the primary.</p>
      <div class="g-row">
        <Tool label="New card" hot @click="bump" />
        <Tool label="Plain" @click="bump" />
        <Tool label="Disabled" disabled @click="bump" />
      </div>
      <code class="g-state">clicks = {{ pressed }}</code>
    </section>

    <section class="g-section">
      <h2>PropertyEditor <span>property-editor</span></h2>
      <p class="g-note">Field-driven form: text, textarea, enum (buttons), boolean toggle.</p>
      <div class="g-row g-pe">
        <PropertyEditor
          :fields="peFields"
          :model-value="peValues"
          @update:model-value="peOut = $event"
        />
      </div>
      <code class="g-state">values = {{ JSON.stringify(peOut) }}</code>
    </section>

    <section class="g-section">
      <h2>Graph2D <span>viz/graph</span></h2>
      <p class="g-note">
        Force-directed graph. Core is dimension-agnostic (<code>pos: number[]</code>) — axis 3 =
        spatial z, axis 4 = construction sequence, axis 5 = discipline. SVG-2D now; a GL renderer
        reuses the same core later.
      </p>
      <div class="g-row g-graph">
        <Graph2D
          :nodes="gNodes"
          :edges="gEdges"
          :width="560"
          :height="360"
          @node-click="onNodeClick"
        />
      </div>
      <code class="g-state"
        >clicked = {{ gClicked }} · nodes = {{ gNodes.length }} · edges = {{ gEdges.length }}</code
      >
    </section>
  </div>
</template>

<style>
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, sans-serif;
  background: var(--aether-surface);
  color: var(--aether-ink);
}
.gallery {
  max-width: 880px;
  margin: 0 auto;
  padding: 40px 24px 80px;
}
.g-head h1 {
  font-size: 28px;
  margin: 0 0 4px;
}
.g-head p {
  color: var(--aether-ink-soft);
  margin: 0 0 24px;
}
.g-section {
  border-top: 1px solid var(--aether-line);
  padding: 24px 0;
}
.g-section h2 {
  font-size: 18px;
  margin: 0 0 4px;
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.g-section h2 span {
  font-size: 12px;
  font-weight: 400;
  color: var(--aether-cool);
  font-family: ui-monospace, monospace;
}
.g-note {
  color: var(--aether-ink-soft);
  font-size: 13px;
  margin: 0 0 14px;
}
.g-note code,
.g-state {
  font-family: ui-monospace, monospace;
}
.g-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.g-pe {
  max-width: 360px;
}
.g-state {
  display: block;
  margin-top: 12px;
  font-size: 12px;
  color: var(--aether-ink-soft);
  background: var(--aether-panel);
  padding: 6px 10px;
  border-radius: 6px;
}
</style>
