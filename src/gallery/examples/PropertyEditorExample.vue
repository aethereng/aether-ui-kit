<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import PropertyEditor from '@aether/ui-kit/property-editor'
import type { FieldDescriptor, FieldValues } from '@aether/ui-kit/property-editor/core'

/* The form is DATA, not markup: a descriptor list in, values out. That is the point of the
   component — a host that gains a field adds a row here rather than editing a template. */
const fields: FieldDescriptor[] = [
  { key: 'title', label: 'Title', type: 'text', placeholder: 'Untitled' },
  /* autogrow: height tracks content instead of a fixed row count, live — see TextFieldExample
     for the field on its own. Off by default, so every OTHER textarea in a form stays exactly
     as it already was; this is the one row in this form that opts in. */
  { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Write…', autogrow: true },
  /* number: step/min/max/precision map straight to the native input's attributes. `suffix` is
     rendered after the field with NO meaning attached — the kit renders a unit, it never knows
     one, so conversion and unit systems stay with the caller. Out of range fails validation. */
  { key: 'load', label: 'Design load', type: 'number', min: 0, max: 500, precision: 1, suffix: 'kN' },
  { key: 'count', label: 'Bays', type: 'number', min: 1, max: 40, step: 1 },
  /* range: the same data as `number` and the same min/max/step, but dragged rather than typed —
     for a value where the SCALE matters more than the digits. It never writes a corrected value
     back: a native range snaps its THUMB to the nearest step, so a component that read `.value`
     back on render would silently rewrite an off-grid stored value for a field nobody touched. */
  { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05, suffix: '×' },
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
  /* Given a real value: an EMPTY date input renders the UA's grey mm/dd/yyyy segments, which
     is the one place a themed form still looked unstyled. */
  { key: 'due', label: 'Due', type: 'date' },
  /* boolean renders as a switch rather than a checkbox — 38x22 with its own knob geometry.
     `swatch` takes a raw CSS declaration list, exactly as ChipOption.swatch does: a toggle for a
     coloured layer carries that layer's own encoding, so the panel reads as its own legend rather
     than needing one beside it. The kit renders the declaration and interprets none of it. */
  { key: 'live', label: 'Live', type: 'boolean' },
  { key: 'alarms', label: 'Alarms', type: 'boolean', swatch: 'background:var(--aether-rose)' },
  { key: 'setpoints', label: 'Setpoints', type: 'boolean', swatch: 'border:1.5px dashed var(--aether-cool)' },
]

const values: FieldValues = {
  title: '',
  body: '',
  load: 120.5,
  count: 6,
  kind: 'fact',
  stage: 'draft',
  due: '2026-08-21',
  live: true,
  opacity: 0.65,
  supports: true,
  loads: false,
}

/* Controlled: the editor never mutates what it is given, it emits a whole new value object. */
const out = ref<FieldValues>({ ...values })
</script>

<template>
  <!-- The SAME descriptor list, rendered both ways. `labelPlacement` is whole-component rather
       than per field, because a form should be internally consistent — and it changes no markup,
       only where the label sits, so a host's overrides keep matching either way.

       Note which fields do NOT move: the range, the button group and the three switches have no
       border to sit inside, so they keep their label above in both columns. That is the rule, not
       an omission. -->
  <div class="g-pe-pair">
    <div>
      <p class="g-pe-cap"><code>labelPlacement="above"</code> — the default. A property sheet.</p>
      <div class="g-pe">
        <PropertyEditor :fields="fields" :model-value="values" @update:model-value="out = $event" />
      </div>
    </div>
    <div>
      <p class="g-pe-cap"><code>labelPlacement="inside"</code> — for form surfaces.</p>
      <div class="g-pe">
        <PropertyEditor
          label-placement="inside"
          :fields="fields"
          :model-value="values"
          @update:model-value="out = $event"
        />
      </div>
    </div>
  </div>

  <code class="g-ex-state">values = {{ JSON.stringify(out) }}</code>
</template>

<style scoped>
.g-pe-pair {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
}
.g-pe-cap {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--aether-ink-soft);
}
</style>
