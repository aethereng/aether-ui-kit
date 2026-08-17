<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import NumberField from '@aether/ui-kit/controls/number-field'

/* Type "0." into the flow rate and watch the read-out below: it does NOT become 0. That is why
   this is a separate component and not a `type` on TextField — a field committing every keystroke
   would rewrite the model mid-decimal and 0.5 would be unreachable. */
const flow = ref(2.5)
const ratio = ref(1.0)
const setpoint = ref<number | undefined>(65)
</script>

<template>
  <div class="g-nf">
    <label class="g-nf-row"><span>Flow rate</span>
      <NumberField v-model="flow" :min="0" :step="0.5" suffix="L/min" />
    </label>

    <!-- `precision` derives the step when none is given: 2 → 0.01, so the spinner moves by a sane
         amount for the decimals expected. It does not round what is stored or shown. -->
    <label class="g-nf-row"><span>Mixing ratio — precision 2, no explicit step</span>
      <NumberField v-model="ratio" :precision="2" />
    </label>

    <!-- Clearing it emits `undefined`, not 0: a caller has to tell "no value" from "zero", and
         only `validity.badInput` separates an empty field from a half-typed one. -->
    <label class="g-nf-row"><span>Setpoint — clear this one</span>
      <NumberField v-model="setpoint" suffix="°C" placeholder="—" />
    </label>

    <code class="g-ex-state">flow = {{ flow }} · ratio = {{ ratio }} · setpoint = {{ setpoint === undefined ? 'undefined' : setpoint }}</code>
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
