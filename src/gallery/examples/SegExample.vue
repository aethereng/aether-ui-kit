<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE. The gallery renders it as the Seg demo and shows this same source in
 * the Template and Script tabs, sliced out of it at runtime — so what you read is what ran.
 *
 * It imports through the published specifier rather than a relative path, which makes the example
 * copy-pasteable AND makes it a live check that the package's own exports map resolves. */
import { computed, ref } from 'vue'
import Seg from '@aether/ui-kit/controls/seg'
import type { SegOption } from '@aether/ui-kit/controls/core'

/* Default variant: a toolbar control. Square corners, panel-grey active segment. */
const view = ref<'cards' | 'graph'>('cards')
const viewOptions: SegOption<'cards' | 'graph'>[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'graph', label: 'Graph' },
]

/* Pill variant: a fully rounded capsule of uppercase mono labels with an accent-wash active
 * segment. Shown as TWO adjacent capsules because that pairing is the reason the variant exists —
 * it lets two independent selectors share one header without reading as a single six-option
 * control. A lone pill would show the styling and hide the point. */
const shape = ref<'graph' | 'list' | 'tree'>('graph')
const shapeOptions: SegOption<'graph' | 'list' | 'tree'>[] = [
  { value: 'graph', label: 'Graph' },
  { value: 'list', label: 'List' },
  { value: 'tree', label: 'Tree' },
]

const layout = ref<'force' | 'folders' | 'hubs'>('force')
const layoutOptions: SegOption<'force' | 'folders' | 'hubs'>[] = [
  { value: 'force', label: 'Force' },
  { value: 'folders', label: 'Folders' },
  { value: 'hubs', label: 'Hubs' },
]

/* Edge case worth seeing: a single option is still a valid Seg, and clicking the already-active
 * option emits nothing. */
const only: SegOption<'a'>[] = [{ value: 'a', label: 'Only option' }]

/* modelValue accepts null, for a preset selector over continuous state: when the real value
 * matches no preset, NOTHING is active. The alternative — a synthetic "Custom" option — lies
 * about the option set and becomes selectable, so it needs its own guard. Type a width to see it
 * fall out of, and back into, the presets. */
const width = ref(137)
const presets: SegOption<'sm' | 'md' | 'lg'>[] = [
  { value: 'sm', label: '120' },
  { value: 'md', label: '240' },
  { value: 'lg', label: '360' },
]
const PRESET_PX = { sm: 120, md: 240, lg: 360 } as const
const matched = computed<'sm' | 'md' | 'lg' | null> (() => {
  const hit = (Object.keys(PRESET_PX) as Array<keyof typeof PRESET_PX>)
    .find((k) => PRESET_PX[k] === width.value)
  return hit ?? null
})
</script>

<template>
  <div class="g-ex">
    <span class="g-variant">default — a toolbar control</span>
    <Seg v-model="view" :options="viewOptions" aria-label="View" />
  </div>

  <div class="g-ex">
    <!-- Labelled, because the accent wash on the active segment is a deliberate part of the
         variant and without a caption it just reads as two segs coloured differently. -->
    <span class="g-variant">variant="pill" — two capsules sharing one header</span>
    <div class="g-ex-row">
      <Seg v-model="shape" variant="pill" :options="shapeOptions" aria-label="Shape" />
      <Seg v-model="layout" variant="pill" :options="layoutOptions" aria-label="Layout" />
    </div>
  </div>

  <div class="g-ex">
    <span class="g-variant">a single option is still valid</span>
    <Seg :options="only" :model-value="'a'" aria-label="Single" />
  </div>

  <div class="g-ex">
    <span class="g-variant">modelValue = null — nothing matches, so nothing is active</span>
    <div class="g-ex-row">
      <Seg
        :options="presets"
        :model-value="matched"
        aria-label="Width preset"
        @change="width = PRESET_PX[$event]"
      />
      <input v-model.number="width" type="number" step="1" aria-label="Width in px" />
    </div>
  </div>

  <code class="g-ex-state">
    view = "{{ view }}" · shape = "{{ shape }}" · layout = "{{ layout }}" · width = {{ width }} →
    preset {{ matched ?? 'null (none)' }}
  </code>
</template>
