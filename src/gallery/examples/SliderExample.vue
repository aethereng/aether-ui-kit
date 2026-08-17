<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Slider from '@aether/ui-kit/controls/slider'
import type { SliderTick } from '@aether/ui-kit/controls/core'

const opacity = ref(0.65)

/* A slider position is not always the value it shows. This one is 0–100 and maps through a
   logarithmic zoom, printed with the precision that matters at each magnitude — which is what
   `format` is for. Without it the read-out could only print "50", the wrong quantity entirely. */
const zoom = ref(50)
const factor = (pos: number) => 0.05 * Math.pow(10, pos / 33)
const zoomLabel = (pos: number) => {
  const f = factor(pos)
  return f < 1 ? `×${f.toFixed(2)}` : f < 10 ? `×${f.toFixed(1)}` : `×${Math.round(f)}`
}
/* ×1 lands at position 43 on this curve — not the middle, and nothing about the track says so.
   That is the case for `ticks`: on a non-linear scale the meaningful value sits somewhere
   arbitrary, and a mark is what puts it back within reach. */
const zoomTicks: SliderTick[] = [{ value: 43, label: '×1' }]
</script>

<template>
  <div class="g-sl">
    <label class="g-sl-row"><span>Opacity — the stored value, shown as a percentage</span>
      <Slider
        v-model="opacity"
        :min="0"
        :max="1"
        :step="0.01"
        :format="(v) => String(Math.round(v * 100))"
        suffix="%"
      />
    </label>

    <label class="g-sl-row"><span>Zoom — a mapped value, with a tick at ×1</span>
      <Slider v-model="zoom" :min="0" :max="100" :step="1" :format="zoomLabel" :ticks="zoomTicks" />
    </label>

    <code class="g-ex-state">opacity = {{ opacity }} · zoom = {{ zoom }} → {{ zoomLabel(zoom) }}</code>
  </div>
</template>

<style scoped>
.g-sl {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 340px;
}
.g-sl-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.g-sl-row > span {
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
}
</style>
