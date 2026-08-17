<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import RadioGroup from '@aether/ui-kit/controls/radio-group'
import Seg from '@aether/ui-kit/controls/seg'
import type { RadioOption } from '@aether/ui-kit/controls/core'

/* A VALUE: picking a unit changes what the numbers beside it mean. Nothing appears or disappears,
   so there is no panel to announce — which is what makes this a radiogroup and not a tab strip. */
const unit = ref('c')
const units: RadioOption[] = [
  { value: 'c', label: '°C' },
  { value: 'f', label: '°F' },
  { value: 'k', label: 'K' },
]

const smoothing = ref('raw')
const smoothings: RadioOption[] = [
  { value: 'raw', label: 'Raw' },
  { value: 'mean', label: 'Rolling mean' },
  { value: 'savgol', label: 'Savitzky–Golay', disabled: true },
]

/* A TAB STRIP, for contrast: choosing swaps the fields below it. Same pixels, different thing to
   say — and the two sit side by side here because that is the only decision worth making when you
   reach for either. */
const source = ref<'sensor' | 'manual'>('sensor')
</script>

<template>
  <div class="g-rg">
    <div class="g-rg-row">
      <span class="g-rg-cap">Units — a value</span>
      <RadioGroup v-model="unit" :options="units" aria-label="Units" />
    </div>

    <div class="g-rg-row">
      <span class="g-rg-cap">Smoothing — a value, one option unavailable</span>
      <RadioGroup v-model="smoothing" :options="smoothings" aria-label="Smoothing" />
    </div>

    <div class="g-rg-row">
      <span class="g-rg-cap">Source — a tab strip, so Seg</span>
      <Seg
        v-model="source"
        :options="[
          { value: 'sensor', label: 'Sensor' },
          { value: 'manual', label: 'Manual' },
        ]"
        aria-label="Source"
      />
      <span class="g-rg-swap">{{ source === 'sensor' ? 'channel · sample rate' : 'value · recorded at' }}</span>
    </div>

    <code class="g-ex-state">unit = {{ unit }} · smoothing = {{ smoothing }} · source = {{ source }}</code>
  </div>
</template>

<style scoped>
.g-rg {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: flex-start;
}
.g-rg-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.g-rg-cap {
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
}
.g-rg-swap {
  font-size: 12px;
  color: var(--aether-faint);
}
</style>
