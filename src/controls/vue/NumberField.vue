<script setup lang="ts">
/* A number field, which is a different control from a text field rather than a `type` on one.
 *
 * WHY IT IS ITS OWN COMPONENT. Two reasons, both structural:
 *
 *   COMMIT SEMANTICS. A text field commits every keystroke. A number field that did would rewrite
 *   the model to 1 the moment you type "1.", and you could never reach 1.5. `coerceNumberInput`
 *   distinguishes mid-typing from genuinely cleared using `validity.badInput`, which is the only
 *   signal that tells them apart — an unparseable number input reports an EMPTY `.value`, so
 *   without it "1." and "" are indistinguishable.
 *
 *   DOM. The border lives on a WRAPPER with a borderless input inside, so the unit sits inside the
 *   box. Doing it the other way — a bordered input with a sibling span — reads as two controls and
 *   makes the unit look like a caption.
 *
 * The framework a consumer is migrating off has no separate number component, so its number fields
 * are text fields wearing `type="number"`. That conflation is the framework's, not the domain's,
 * and it is not worth copying in. */
import { coerceNumberInput, numberStep } from '../../property-editor/core/PropertyEditorEngine'

const props = withDefaults(
  defineProps<{
    modelValue: number | undefined
    min?: number
    max?: number
    step?: number
    /** Decimal places, used to derive `step` when `step` is not given: 2 -> 0.01. */
    precision?: number
    /** Rendered inside the box after the number. The kit renders a unit; it never knows one. */
    suffix?: string
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    min: undefined,
    max: undefined,
    step: undefined,
    precision: undefined,
    suffix: undefined,
    placeholder: undefined,
    disabled: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: number | undefined] }>()

/* Commits only on a COMPLETE number, or on a genuinely emptied field. An in-progress keystroke is
   left alone rather than written back. */
function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const result = coerceNumberInput(el.value, el.validity.badInput)
  if (result.commit) emit('update:modelValue', result.value)
}
</script>

<template>
  <div class="aether-numberfield">
    <input
      type="number"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="numberStep({ step: props.step, precision: props.precision })"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput"
    />
    <span v-if="suffix" class="aether-numberfield__suffix">{{ suffix }}</span>
  </div>
</template>

<style scoped>
.aether-numberfield {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
  background: var(--aether-surface);
  border: 1px solid var(--aether-line-strong);
  border-radius: 7px;
  padding: 7px 9px;
}
/* Focus lives on the WRAPPER, since the wrapper is the thing with the border. Styling the input's
   own :focus would decorate an element that no longer has a visible edge, and the field would give
   no focus feedback at all. */
.aether-numberfield:focus-within {
  border-color: var(--aether-ink-soft);
}
.aether-numberfield input[type='number'] {
  flex: 1 1 auto;
  min-width: 0;
  width: auto;
  font: inherit;
  font-size: 13.5px;
  color: var(--aether-ink);
  border: 0;
  background: transparent;
  padding: 0;
  border-radius: 0;
  accent-color: var(--aether-cool);
}
.aether-numberfield input[type='number']:focus {
  outline: none;
}
.aether-numberfield__suffix {
  flex: none;
  font-size: 12px;
  color: var(--aether-ink-soft);
  white-space: nowrap;
  /* the unit is not a value: never let it be selected instead of the number */
  user-select: none;
}
</style>
