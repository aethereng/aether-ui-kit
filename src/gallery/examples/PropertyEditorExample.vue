<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import PropertyEditor from '@aether/ui-kit/property-editor'
import type { FieldDescriptor, FieldValues } from '@aether/ui-kit/property-editor/core'

/* The form is DATA, not markup: a descriptor list in, values out. That is the point of the
   component — a host that gains a field adds a row here rather than editing a template. */
const fields: FieldDescriptor[] = [
  { key: 'title', label: 'Title', type: 'text', placeholder: 'Untitled' },
  { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Write…' },
  /* number: step/min/max/precision map straight to the native input's attributes. `suffix` is
     rendered after the field with NO meaning attached — the kit renders a unit, it never knows
     one, so conversion and unit systems stay with the caller. Out of range fails validation. */
  { key: 'load', label: 'Design load', type: 'number', min: 0, max: 500, precision: 1, suffix: 'kN' },
  { key: 'count', label: 'Bays', type: 'number', min: 1, max: 40, step: 1 },
  {
    key: 'kind',
    label: 'Kind',
    type: 'enum',
    /* variant: 'buttons' lays the options out as a row; the default is a native select, which
       is the right choice once there are more options than fit. */
    variant: 'buttons',
    options: [
      { value: 'fact', label: 'Fact' },
      { value: 'idea', label: 'Idea' },
      { value: 'risk', label: 'Risk' },
    ],
  },
  {
    key: 'stage',
    label: 'Stage',
    type: 'enum',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'review', label: 'In review' },
      { value: 'signed', label: 'Signed' },
    ],
  },
  { key: 'due', label: 'Due', type: 'date' },
  /* boolean renders as a switch rather than a checkbox — 38x22 with its own knob geometry. */
  { key: 'live', label: 'Live', type: 'boolean' },
]

const values: FieldValues = {
  title: '',
  body: '',
  load: 120.5,
  count: 6,
  kind: 'fact',
  stage: 'draft',
  due: '',
  live: true,
}

/* Controlled: the editor never mutates what it is given, it emits a whole new value object. */
const out = ref<FieldValues>({ ...values })
</script>

<template>
  <div class="g-pe">
    <PropertyEditor :fields="fields" :model-value="values" @update:model-value="out = $event" />
  </div>

  <code class="g-ex-state">values = {{ JSON.stringify(out) }}</code>
</template>
