<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import RadioGroup from '@aether/ui-kit/controls/radio-group'
import Seg from '@aether/ui-kit/controls/seg'
import type { RadioOption } from '@aether/ui-kit/controls/core'

/* A VALUE: picking a unit changes what the numbers beside it mean. Nothing appears or disappears,
   so there is no panel to announce — which is what makes this a radiogroup and not a tab strip. */
const unit = ref('mm')
const units: RadioOption[] = [
  { value: 'mm', label: 'SI (mm)' },
  { value: 'in', label: 'US (in)' },
]

const mode = ref('analytical')
const modes: RadioOption[] = [
  { value: 'analytical', label: 'Analytical' },
  { value: 'solids', label: 'Solids' },
  { value: 'shells', label: 'Shells', disabled: true },
]

/* A TAB STRIP, for contrast: choosing swaps the field set below it. Same pixels, different thing
   to say — and the two are side by side here because that is the only decision worth making when
   you reach for either. */
const source = ref<'catalog' | 'custom'>('catalog')
</script>

<template>
  <div class="g-rg">
    <div class="g-rg-row">
      <span class="g-rg-cap">Units — a value</span>
      <RadioGroup v-model="unit" :options="units" aria-label="Units" />
    </div>

    <div class="g-rg-row">
      <span class="g-rg-cap">Analysis model — a value, one option disabled</span>
      <RadioGroup v-model="mode" :options="modes" aria-label="Analysis model" />
    </div>

    <div class="g-rg-row">
      <span class="g-rg-cap">Material source — a tab strip, so Seg</span>
      <Seg
        v-model="source"
        :options="[
          { value: 'catalog', label: 'Catalog' },
          { value: 'custom', label: 'Custom' },
        ]"
        aria-label="Material source"
      />
      <span class="g-rg-swap">{{ source === 'catalog' ? 'Grade dropdown' : 'fy · fu · E · ν · ρ' }}</span>
    </div>

    <code class="g-ex-state">unit = {{ unit }} · mode = {{ mode }} · source = {{ source }}</code>
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
