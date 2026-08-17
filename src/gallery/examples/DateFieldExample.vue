<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import DateField from '@aether/ui-kit/controls/date-field'

/* `YYYY-MM-DD` or '' — the native input's own value format, kept rather than invented so a caller
   can hand it straight to a date input, a JSON payload or `new Date()` without a conversion step. */
const start = ref('2026-08-17')
const end = ref('')
</script>

<template>
  <div class="g-df">
    <label class="g-df-row" for="df-start"><span>Start</span></label>
    <DateField id="df-start" v-model="start" />

    <label class="g-df-row" for="df-end"><span>End — empty until picked</span></label>
    <DateField id="df-end" v-model="end" />

    <code class="g-ex-state">start = {{ start || '(empty)' }} · end = {{ end || '(empty)' }}</code>
  </div>
</template>

<style scoped>
.g-df {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 260px;
}
.g-df-row > span {
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--aether-ink-soft);
}
.g-df-row + * {
  margin-bottom: 6px;
}
</style>
