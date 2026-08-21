<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import TextField from '@aether/ui-kit/controls/text-field'

const label = ref('Batch A-14')
const note = ref('')
const longNote = ref(
  'This field grows with what you put in it.\n\nType past a few lines and watch the box follow — no scrollbar hiding the rest of it, no drag handle to fight with, because there is nothing left for one to do.\n\nThat growth has a ceiling, though: eight rows by default (maxRows). Past that it stops pushing on whatever layout it sits in — this card, in this demo — and scrolls internally instead, the same themed scrollbar a plain multiline field shows when its own fixed rows overflow.\n\nThis paragraph exists to prove it: long enough on its own that the field above is already past its ceiling and scrolling before you have typed a single character.',
)
</script>

<template>
  <div class="g-tf">
    <label class="g-tf-row"><span>Sample label</span>
      <TextField v-model="label" placeholder="Untitled" />
    </label>

    <!-- `multiline` is a PROP, not a second component: a textarea types exactly like an input —
         same data, same commit-per-keystroke, same bordered box — and only its shape differs. -->
    <label class="g-tf-row"><span>Note — multiline</span>
      <TextField v-model="note" multiline :rows="2" placeholder="Anything worth recording…" />
    </label>

    <!-- autogrow: height tracks content instead of the fixed `rows` above, growing and
         shrinking live as it's typed — and resize switches off, since auto-grow already IS
         the resize. Seeded past its 8-row default ceiling on purpose, so the demo shows the
         capped-and-scrolling state at rest, not just the open-ended growth. Try adding or
         deleting lines — including past the point where it starts scrolling instead of growing. -->
    <label class="g-tf-row"><span>Note — autogrow (capped at 8 rows)</span>
      <TextField v-model="longNote" multiline autogrow placeholder="Grows as you type…" />
    </label>

    <label class="g-tf-row"><span>Disabled</span>
      <TextField model-value="Locked while the run is active" disabled />
    </label>

    <code class="g-ex-state">{{ JSON.stringify({ label, note, longNote }) }}</code>
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
