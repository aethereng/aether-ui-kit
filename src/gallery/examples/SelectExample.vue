<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Select from '@aether/ui-kit/controls/select'
import type { SelectGroup } from '@aether/ui-kit/controls/core'

const solvent = ref('etoh')
const channel = ref('t-2')

const solvents = [
  { value: 'h2o', label: 'Water' },
  { value: 'etoh', label: 'Ethanol' },
  { value: 'meoh', label: 'Methanol' },
  { value: 'dcm', label: 'Dichloromethane', disabled: true },
]

/* Groups are structure, not decoration. Flattened into one list, a channel that is MEASURED and one
   that is COMPUTED from other channels become indistinguishable — and `subtitle` is what lets two
   similarly named rows tell themselves apart. */
const channelGroups: SelectGroup[] = [
  {
    label: 'Measured',
    options: [
      { value: 't-1', label: 'T-1 · inlet' },
      { value: 't-2', label: 'T-2 · reactor' },
    ],
  },
  {
    label: 'Derived',
    options: [
      { value: 'dt', label: 'ΔT', subtitle: 'T-2 − T-1' },
      { value: 'q', label: 'Heat duty', subtitle: 'ṁ · cp · ΔT' },
    ],
  },
]
</script>

<template>
  <div class="g-sel">
    <label class="g-sel-row"><span>Solvent — a flat list</span>
      <Select v-model="solvent" :options="solvents" />
    </label>

    <label class="g-sel-row"><span>Channel — two kinds of thing, so two groups</span>
      <Select v-model="channel" :groups="channelGroups" />
    </label>

    <code class="g-ex-state">solvent = {{ solvent }} · channel = {{ channel }}</code>
  </div>
</template>

<style scoped>
.g-sel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 340px;
}
.g-sel-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.g-sel-row > span {
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
}
</style>
