<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import TextField from '@aether/ui-kit/controls/text-field'

const name = ref('Beam 14')
const note = ref('')
</script>

<template>
  <div class="g-tf">
    <label class="g-tf-row"><span>Name</span>
      <TextField v-model="name" placeholder="Untitled" />
    </label>

    <!-- `multiline` is a PROP, not a second component: a textarea types exactly like an input —
         same data, same commit-per-keystroke, same bordered box — and only its shape differs. -->
    <label class="g-tf-row"><span>Note — multiline</span>
      <TextField v-model="note" multiline :rows="2" placeholder="Anything worth recording…" />
    </label>

    <label class="g-tf-row"><span>Disabled</span>
      <TextField model-value="Locked by the solver" disabled />
    </label>

    <code class="g-ex-state">{{ JSON.stringify({ name, note }) }}</code>
  </div>
</template>

<style scoped>
.g-tf {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 340px;
}
.g-tf-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.g-tf-row > span {
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
}
</style>
