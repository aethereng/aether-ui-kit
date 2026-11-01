<script setup lang="ts">
/* A checkbox drawn as a small key: a well pressed into the surface when off; when on it stands up and
 * lights in the two colours of the mark, with a dot in it; a group partly on is dimmed, with a bar.
 *
 * DELIBERATELY NOT Switch, which stays for a setting that takes effect as it moves. This is for a choice
 * in a list: rows of it read as a column at 16px, where a 38px pill does not fit a table's row, and it
 * has the third state a group needs, which an on-or-off pill has no way to draw.
 *
 * A BUTTON WITH role="checkbox", as RadioGroup's options are role="radio". A native input cannot hold a
 * visible label inside it, and a <label> around one would nest inside a form's own <label for>, which is
 * invalid. A button holds the label slot and a caller's <label for> can still name it. It takes no part
 * in a form's submission: the caller owns the value, as with every control here.
 *
 * Space is handled here rather than left to the button's own click, because a button also clicks on
 * Enter and a checkbox does not. The keydown takes Space and blocks Enter, and the keyup stops the click
 * a browser would add on the way up. A key held down presses once.
 *
 * CONTROLLED. A press emits and nothing moves until the caller writes the value back, so a caller that
 * refuses a change never has a key disagreeing with its data. */
import { computed } from 'vue'
import {
  ariaChecked,
  checkboxLengths,
  checkState,
  isCheckboxKey,
  nextChecked,
} from '../core/checkbox'
import type { CheckboxProps } from '../core/types'

const props = withDefaults(defineProps<CheckboxProps>(), {
  mixed: false,
  disabled: false,
  label: undefined,
  size: 16,
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const slots = defineSlots<{
  /** The visible label, inside the button, so a press on it presses the key. It is the accessible name. */
  default?: () => unknown
}>()

const drawn = computed(() => checkState(props.modelValue, props.mixed))

const lengths = computed(() => {
  const l = checkboxLengths(props.size)
  return {
    '--side': `${l.side}px`,
    '--radius': `${l.radius}px`,
    '--dot': `${l.dot}px`,
    '--bar-width': `${l.barWidth}px`,
    '--bar-height': `${l.barHeight}px`,
  }
})

function press() {
  if (!props.disabled) emit('update:modelValue', nextChecked(props.modelValue, props.mixed))
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
  } else if (isCheckboxKey(e.key)) {
    e.preventDefault()
    if (!e.repeat) press()
  }
}

function onKeyup(e: KeyboardEvent) {
  if (isCheckboxKey(e.key)) e.preventDefault()
}
</script>

<template>
  <button
    type="button"
    role="checkbox"
    class="aether-checkbox"
    :class="`aether-checkbox--${drawn}`"
    :style="lengths"
    :aria-checked="ariaChecked(drawn)"
    :aria-label="slots.default ? undefined : label"
    :disabled="disabled"
    @click="press"
    @keydown="onKeydown"
    @keyup="onKeyup"
  >
    <span class="aether-checkbox__key" aria-hidden="true"><span class="aether-checkbox__glyph" /></span>
    <span v-if="slots.default" class="aether-checkbox__label"><slot /></span>
  </button>
</template>

<style scoped>
.aether-checkbox {
  /* The kit ships no global reset, so a control sized here states its own box model. */
  box-sizing: border-box;
  padding: 0;
  border: 0;
  margin: 0;
  background: none;
  color: var(--aether-ink);
  font-family: inherit;
  font-size: var(--aether-control-font-size);
  text-align: left;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 7px;
  cursor: pointer;
  flex: none;
}

.aether-checkbox__key {
  box-sizing: border-box;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--side);
  height: var(--side);
  border-radius: var(--radius);
  /* The well. The ring is what identifies the control on its ground, so it carries the 3:1 a graphic
     owes; contrast.test.ts holds the mix against both grounds in every theme. */
  background: color-mix(in srgb, var(--aether-ink) 6%, transparent);
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.32),
    inset 0 0 0 1px color-mix(in srgb, var(--aether-ink) 52%, transparent);
  transition:
    background 0.14s,
    box-shadow 0.14s,
    transform 0.12s;
}
.aether-checkbox:hover:not(:disabled) .aether-checkbox__key {
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.32),
    inset 0 0 0 1px var(--aether-ink);
}
.aether-checkbox:active:not(:disabled) .aether-checkbox__key {
  transform: scale(0.92);
}

/* On: it stands up and lights. The gradient runs between the host's two mark colours, the outer shadow
   lifts it off the surface, and the top edge catches the light. */
.aether-checkbox--on .aether-checkbox__key,
.aether-checkbox--on:hover:not(:disabled) .aether-checkbox__key {
  background: linear-gradient(160deg, var(--aether-mark-warm), var(--aether-mark-cool));
  box-shadow:
    0 1px 5px color-mix(in srgb, var(--aether-mark-cool) 50%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.32);
}

/* Partly on: the same light, dimmed by a mix with the ground rather than by opacity, so that the bar on
   it stays at full strength. */
.aether-checkbox--mixed .aether-checkbox__key,
.aether-checkbox--mixed:hover:not(:disabled) .aether-checkbox__key {
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--aether-mark-warm) 62%, var(--aether-surface)),
    color-mix(in srgb, var(--aether-mark-cool) 62%, var(--aether-surface))
  );
  /* A dimmed fill cannot hold 3:1 on its ground, so the well's ring stays as its edge. */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 0 0 1px color-mix(in srgb, var(--aether-ink) 52%, transparent);
}

/* The dot and the bar are one element, so a state only ever draws one of them. The ink is the one
   written for a filled tone, which inverts with the theme. */
.aether-checkbox__glyph {
  display: block;
  width: var(--dot);
  height: var(--dot);
  border-radius: 50%;
  background: var(--aether-warm-ink);
  transform: scale(0);
  transition: transform 0.16s cubic-bezier(0.3, 1.6, 0.6, 1);
}
.aether-checkbox--on .aether-checkbox__glyph {
  transform: scale(1);
}
.aether-checkbox--mixed .aether-checkbox__glyph {
  width: var(--bar-width);
  height: var(--bar-height);
  border-radius: 1px;
  background: var(--aether-ink);
  transform: scale(1);
}

.aether-checkbox:disabled {
  cursor: default;
  opacity: 0.55;
}

/* The kit's ring, on the key rather than around the label, so a column of these keeps its edge. */
.aether-checkbox:focus-visible {
  outline: none;
}
.aether-checkbox:focus-visible .aether-checkbox__key {
  outline: 2px solid var(--aether-cool);
  outline-offset: 2px;
}

/* Dense, because these repeat down a list. The key keeps its size and the button around it grows, which
   Switch cannot do: its track is its target. */
@media (pointer: coarse) {
  .aether-checkbox {
    min-width: var(--aether-touch-dense);
    min-height: var(--aether-touch-dense);
  }
}

@media (prefers-reduced-motion: reduce) {
  .aether-checkbox__key,
  .aether-checkbox__glyph {
    transition: none;
  }
  .aether-checkbox:active:not(:disabled) .aether-checkbox__key {
    transform: none;
  }
}

/* A forced palette takes away every shadow and leaves the gradient, so off would lose its edge and on
   would keep colours the reader did not choose. The states are drawn again in the system's colours. */
@media (forced-colors: active) {
  .aether-checkbox__key {
    forced-color-adjust: none;
    background: Canvas;
    box-shadow: none;
    border: 1px solid ButtonText;
  }
  .aether-checkbox--on .aether-checkbox__key,
  .aether-checkbox--on:hover:not(:disabled) .aether-checkbox__key,
  .aether-checkbox--mixed .aether-checkbox__key,
  .aether-checkbox--mixed:hover:not(:disabled) .aether-checkbox__key {
    background: Highlight;
    box-shadow: none;
    border-color: Highlight;
  }
  .aether-checkbox__glyph,
  .aether-checkbox--mixed .aether-checkbox__glyph {
    background: HighlightText;
  }
}
</style>
