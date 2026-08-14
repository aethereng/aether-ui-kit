<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE. The gallery renders it as the Seg demo and shows this same source in
 * the Template and Script tabs, sliced out of it at runtime — so what you read is what ran.
 *
 * It imports through the published specifier rather than a relative path, which makes the example
 * copy-pasteable AND makes it a live check that the package's own exports map resolves. */
import { computed, ref } from 'vue'
import Seg from '@aether/ui-kit/controls/seg'
import Tool from '@aether/ui-kit/controls/tool'
import type { SegOption } from '@aether/ui-kit/controls/core'

/* ONE option set, rendered in both variants, because that is the only way to show what `variant`
 * actually changes. An earlier version of this example used a different vocabulary per block --
 * Cards/Graph, then Graph/List/Tree, then Force/Folders/Hubs -- so a reader had to decode new
 * labels in every block instead of seeing the one difference, and "Graph" meant two unrelated
 * things in two adjacent controls. Same options, one variable. */
type Grain = 'day' | 'week' | 'month'
const grainOptions: SegOption<Grain>[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const grain = ref<Grain>('week')
const grainPill = ref<Grain>('week')

/* `disabled` on an option: documented, styled and honoured by the component, but nothing on the
 * page rendered it until now — an option nobody can see is an option nobody trusts. Clicking it
 * emits nothing. */
const rangeOptions: SegOption<Grain>[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month', disabled: true },
]
const range = ref<Grain>('day')

/* modelValue accepts null, for a preset selector over CONTINUOUS state: when the real value matches
 * no preset, nothing is active. The alternative — a synthetic "Custom" option — lies about the
 * option set and becomes selectable, so it needs its own guard against being chosen.
 *
 * The width is a READ-OUT, not a field: it stands for state the rest of an app owns (a dragged
 * handle, a solver result). Nudge walks it off a preset, so the null state is reachable both ways
 * without implying Seg needs an input beside it. */
const width = ref(137)
const PRESET_PX = { sm: 120, md: 240, lg: 360 } as const
type Preset = keyof typeof PRESET_PX
const presets: SegOption<Preset>[] = [
  { value: 'sm', label: '120' },
  { value: 'md', label: '240' },
  { value: 'lg', label: '360' },
]
const matched = computed<Preset | null>(() => {
  const keys = Object.keys(PRESET_PX) as Preset[]
  return keys.find((k) => PRESET_PX[k] === width.value) ?? null
})
</script>

<template>
  <div class="g-ex g-ex--full">
    <span class="g-variant">default — square corners, panel-grey active segment</span>
    <Seg v-model="grain" :options="grainOptions" aria-label="Granularity" />
  </div>

  <div class="g-ex g-ex--full">
    <!-- Deliberately the SAME options as above: the only thing that differs is `variant`. -->
    <span class="g-variant">
      variant="pill" — the same options as a rounded capsule, uppercase mono, accent-wash active
    </span>
    <Seg v-model="grainPill" variant="pill" :options="grainOptions" aria-label="Granularity, pill" />
  </div>

  <div class="g-ex g-ex--full">
    <span class="g-variant">a disabled option — dimmed, and clicking it emits nothing</span>
    <Seg v-model="range" :options="rangeOptions" aria-label="Range" />
  </div>

  <div class="g-ex g-ex--full">
    <span class="g-variant">modelValue = null — the value matches no preset, so nothing is active</span>
    <div class="g-ex-row">
      <Seg
        :options="presets"
        :model-value="matched"
        aria-label="Width preset"
        @change="width = PRESET_PX[$event]"
      />
      <output class="g-ex-readout">{{ width }}px</output>
      <Tool label="Nudge +1" @click="width += 1" />
    </div>
  </div>

  <code class="g-ex-state">
    grain = "{{ grain }}" · pill = "{{ grainPill }}" · range = "{{ range }}" · width =
    {{ width }}px → preset {{ matched ?? 'null (none)' }}
  </code>
</template>
