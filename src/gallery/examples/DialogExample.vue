<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Dialog from '@aether/ui-kit/controls/dialog'
import Tool from '@aether/ui-kit/controls/tool'
import PropertyEditor from '@aether/ui-kit/property-editor'
import type { FieldDescriptor, FieldValues } from '@aether/ui-kit/property-editor/core'

const open = ref(false)
const locked = ref(false)

/* labelPlacement="inside" is what a dialog wants: the form is the dialog's content, and two lines
   per field in something that already scrolls is the cost this exists to remove. */
const fields: FieldDescriptor[] = [
  { key: 'h', label: 'Height', type: 'number', min: 0, suffix: 'mm' },
  { key: 'b', label: 'Width', type: 'number', min: 0, suffix: 'mm' },
  { key: 'tw', label: 'Web thickness', type: 'number', min: 0, step: 0.1, suffix: 'mm' },
  { key: 'grade', label: 'Grade', type: 'enum', options: [
    { value: 's235', label: 'S235' }, { value: 's355', label: 'S355' } ] },
]
const values: FieldValues = { h: 400, b: 180, tw: 8.6, grade: 's355' }
const out = ref<FieldValues>({ ...values })
</script>

<template>
  <div class="g-dlg">
    <Tool label="Open dialog" hot @click="open = true" />
    <Tool :label="locked ? 'Dismissible: off' : 'Dismissible: on'" @click="locked = !locked" />

    <!-- <dialog> carries the parts that are usually hand-rolled and usually wrong: the top layer
         (so nothing an ancestor clips can clip it), a real focus trap, `inert` on the page behind,
         Escape, ::backdrop, and focus returned to whatever opened it. The component adds a scroll
         lock and a backdrop click, which are the two the platform leaves out. -->
    <Dialog v-model:open="open" title="Section calculator" :dismissible="!locked">
      <PropertyEditor
        label-placement="inside"
        :fields="fields"
        :model-value="values"
        @update:model-value="out = $event"
      />
      <template #footer>
        <Tool label="Cancel" @click="open = false" />
        <Tool label="Apply" hot @click="open = false" />
      </template>
    </Dialog>

    <code class="g-ex-state">values = {{ JSON.stringify(out) }}</code>
  </div>
</template>

<style scoped>
.g-dlg {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
