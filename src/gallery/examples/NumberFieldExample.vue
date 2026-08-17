<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import NumberField from '@aether/ui-kit/controls/number-field'

/* Type "0." into the tolerance and watch the read-out below: it does NOT become 0. That is the
   whole reason this is a separate component rather than a `type` on TextField — a field that
   committed every keystroke would rewrite the model mid-decimal and 0.5 would be unreachable. */
const tolerance = ref(3)
const gammaM0 = ref(1.0)
const cleared = ref<number | undefined>(12)
</script>

<template>
  <div class="g-nf">
    <label class="g-nf-row"><span>Contact tolerance</span>
      <NumberField v-model="tolerance" :min="0" :step="0.5" suffix="mm" />
    </label>

    <!-- `precision` derives the step when none is given: 2 → 0.01, so the spinner increments by a
         sane amount for the decimals expected. It does NOT round what is stored or shown. -->
    <label class="g-nf-row"><span>γM0 — precision 2, no explicit step</span>
      <NumberField v-model="gammaM0" :precision="2" />
    </label>

    <!-- Clearing it emits `undefined`, not 0: a caller has to be able to tell "no value" from
         "zero", and only `validity.badInput` distinguishes an empty field from a half-typed one. -->
    <label class="g-nf-row"><span>Clear this one</span>
      <NumberField v-model="cleared" suffix="kN" placeholder="—" />
    </label>

    <code class="g-ex-state">tolerance = {{ tolerance }} · γM0 = {{ gammaM0 }} · cleared = {{ cleared === undefined ? 'undefined' : cleared }}</code>
  </div>
</template>

<style scoped>
.g-nf {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 340px;
}
.g-nf-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.g-nf-row > span {
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
}
</style>
