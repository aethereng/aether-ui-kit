<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Select from '@aether/ui-kit/controls/select'
import type { SelectGroup } from '@aether/ui-kit/controls/core'

const grade = ref('s355')
const loadCase = ref('lc-2')

const grades = [
  { value: 's235', label: 'S235' },
  { value: 's355', label: 'S355' },
  { value: 's460', label: 'S460', disabled: true },
]

/* Groups are structure, not decoration: flattened into one list, a load case and a combination
   become indistinguishable, which in a structural model is a correctness problem rather than a
   cosmetic one. `subtitle` is what makes two similarly-named rows tell themselves apart. */
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
  <div class="g-sel">
    <label class="g-sel-row"><span>Steel grade — flat options</span>
      <Select v-model="grade" :options="grades" />
    </label>

    <label class="g-sel-row"><span>Load case — two kinds of thing, so two groups</span>
      <Select v-model="loadCase" :groups="caseGroups" />
    </label>

    <code class="g-ex-state">grade = {{ grade }} · loadCase = {{ loadCase }}</code>
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
