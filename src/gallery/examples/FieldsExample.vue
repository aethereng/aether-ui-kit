<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Slider from '@aether/ui-kit/controls/slider'
import Select from '@aether/ui-kit/controls/select'
import NumberField from '@aether/ui-kit/controls/number-field'
import TextField from '@aether/ui-kit/controls/text-field'
import type { SelectGroup, SliderTick } from '@aether/ui-kit/controls/core'

const tolerance = ref(3)
const note = ref('')
const name = ref('Beam 14')
const grade = ref('s355')
const loadCase = ref('lc-2')

/* A slider position is not always the value it shows. This one is 0-100 and maps through a
   non-linear function to a deform factor, printed with the precision that matters at each
   magnitude — which is why `format` exists. Without it a read-out can only print what is stored. */
const deform = ref(50)
const scale = (pos: number) => 0.05 * Math.pow(10, pos / 33)
const deformLabel = (pos: number) => {
  const f = scale(pos)
  return f < 1 ? `×${f.toFixed(2)}` : f < 10 ? `×${f.toFixed(1)}` : `×${Math.round(f)}`
}
/* ×1 is at position 43 of 100 on this curve — not the middle, and nothing about the track says so.
   That is the whole case for `ticks`: on a non-linear scale the meaningful value lands somewhere
   arbitrary, and a mark is the only thing that puts it back on the control. */
const deformTicks: SliderTick[] = [{ value: 43, label: '×1' }]

const grades = [
  { value: 's235', label: 'S235' },
  { value: 's355', label: 'S355' },
  { value: 's460', label: 'S460' },
]

/* Groups are structure, not decoration: flattened into one list, a load case and a combination
   become indistinguishable, which in a structural model is a correctness problem. */
const caseGroups: SelectGroup[] = [
  {
    label: 'Load cases',
    options: [
      { value: 'lc-1', label: 'LC-1 · G' },
      { value: 'lc-2', label: 'LC-2 · Q' },
    ],
  },
  {
    label: 'ULS combinations',
    options: [
      { value: 'c-1', label: 'ULS-1', subtitle: '1.35·G + 1.5·Q' },
      { value: 'c-2', label: 'ULS-2', subtitle: '1.35·G + 1.5·Q + 1.5·S' },
    ],
  },
]
</script>

<template>
  <div class="g-f">
    <label class="g-f-row"><span>Name</span>
      <TextField v-model="name" placeholder="Untitled" />
    </label>

    <label class="g-f-row"><span>Contact tolerance</span>
      <NumberField v-model="tolerance" :min="0" :step="0.5" suffix="mm" />
    </label>

    <label class="g-f-row"><span>Steel grade</span>
      <Select v-model="grade" :options="grades" />
    </label>

    <label class="g-f-row"><span>Load case</span>
      <Select v-model="loadCase" :groups="caseGroups" />
    </label>

    <label class="g-f-row"><span>Deform scale</span>
      <Slider
        v-model="deform"
        :min="0"
        :max="100"
        :step="1"
        :format="deformLabel"
        :ticks="deformTicks"
      />
    </label>

    <label class="g-f-row"><span>Note</span>
      <TextField v-model="note" multiline :rows="2" placeholder="Anything worth recording…" />
    </label>

    <code class="g-ex-state">{{ JSON.stringify({ name, tolerance, grade, loadCase, deform, note }) }}</code>
  </div>
</template>

<style scoped>
.g-f {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 340px;
}
.g-f-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.g-f-row > span {
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
}
</style>
