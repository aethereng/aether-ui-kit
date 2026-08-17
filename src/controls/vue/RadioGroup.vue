<script setup lang="ts" generic="V extends string = string">
/* One choice out of a few, drawn as a row of buttons.
 *
 * WHY IT IS A COMPONENT NOW. It already existed, but only as PropertyEditor's `enum` field with
 * `variant: 'buttons'` — so reaching it meant describing a form: a FieldDescriptor[], a
 * FieldValues object and a (key, value) change handler, to render two buttons. A consumer did
 * exactly that twice in one afternoon, for a units picker and an analysis-mode picker, neither of
 * which is a form. That is the same packaging failure v0.13.0 fixed for the other five controls,
 * left behind because this one had no standalone shape yet. PropertyEditor now composes it, as it
 * composes Switch, Select, Slider, TextField and NumberField.
 *
 * DELIBERATELY NOT Seg, which looks identical and is a different statement. Seg is role="tablist"
 * with role="tab" children: it announces tabs, and it belongs where choosing swaps a panel. This
 * is role="radiogroup" with role="radio" children, for a VALUE — a unit, a mode, a grade. Same
 * pixels, different thing to say, and a screen reader says whichever one you picked.
 *
 * ONE EMIT. v-model is the contract, and nothing else is offered. Seg shipped a second `change`
 * alongside it for a while and has since dropped it; the whole kit is one emit now.
 *
 * The keyboard model lives in this file rather than controls/core, and that is proportionate
 * rather than inconsistent: menuKey and treeKey are in core because a caller building its own menu
 * or tree surface reuses them, while this is ten lines of index arithmetic with exactly one
 * consumer — itself. It moves to core the day something else needs it. */
import { nextTick, useTemplateRef } from 'vue'
import type { RadioOption, RadioGroupProps } from '../core/types'

const props = withDefaults(defineProps<RadioGroupProps<V>>(), { ariaLabel: undefined })

const emit = defineEmits<{ 'update:modelValue': [value: V] }>()

const root = useTemplateRef<HTMLElement>('root')

/* Roving tabindex: exactly ONE button is tabbable, so the group is a single stop in the tab order
   rather than one stop per option. The tabbable one is the checked option — or the first, when
   nothing is checked, because a group you cannot tab into at all is worse than one starting at the
   top. */
function tabIndexFor(value: V): number {
  if (props.modelValue === value) return 0
  const anyChecked = props.options.some((o) => o.value === props.modelValue)
  return !anyChecked && props.options[0]?.value === value ? 0 : -1
}

function select(opt: RadioOption<V>) {
  if (opt.disabled || opt.value === props.modelValue) return
  emit('update:modelValue', opt.value)
}

/* Arrows wrap and they SELECT as they move — the radio pattern, where the focused option is the
   chosen one, so there is no separate commit step. Home/End reach the ends. Space and Enter are
   left to the button's own click. `preventDefault` stops the page scrolling under the group.
   Disabled options are skipped rather than landed on, or an arrow could park focus somewhere that
   refuses to be chosen. */
function onKey(e: KeyboardEvent) {
  const opts = props.options.filter((o) => !o.disabled)
  if (opts.length === 0) return
  const at = opts.findIndex((o) => o.value === props.modelValue)
  let next = -1
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (at + 1 + opts.length) % opts.length
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (at <= 0 ? opts.length : at) - 1
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = opts.length - 1
  else return

  e.preventDefault()
  const value = opts[next]!.value
  emit('update:modelValue', value)
  /* Focus follows selection, or the roving tabindex points at a button the user is not on.
     Post-flush, because the tabindex that makes it focusable renders from the value just set.
     Scoped to THIS group's root: a document-wide lookup would find the first matching button on
     the page, so two groups sharing an option value would steal each other's focus — the kind of
     bug that survives a demo. */
  nextTick(() => {
    root.value?.querySelector<HTMLElement>(`[data-rv="${CSS.escape(value)}"]`)?.focus()
  })
}
</script>

<template>
  <div ref="root" class="aether-radiogroup" role="radiogroup" :aria-label="ariaLabel" @keydown="onKey">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="radio"
      :aria-checked="opt.value === modelValue"
      :data-rv="opt.value"
      :tabindex="tabIndexFor(opt.value)"
      :disabled="opt.disabled"
      :class="{ on: opt.value === modelValue }"
      @click="select(opt)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
/* CHIP'S LANGUAGE, NOT SEG'S — and that is the whole point of the control existing.
 *
 * ui-kit.css carried two unconditional `.aether-property-editor__buttons` blocks, added in the
 * same commit, and the later won on source order. Lining them up against the rest of the kit shows
 * what the collision actually cost: the losing block was Chip's look (`--aether-radius`, a
 * selected-wash fill, accent text) and the winning one was Seg's (`--aether-panel` fill,
 * `--aether-ink` text, weight 600). So an enum group has been rendering as a visual twin of the
 * tab strip it is not — the exact confusion this component was extracted to end, made worse by
 * being invisible in the source.
 *
 * The active state therefore matches Chip, which is the kit's other single-value toggle: a value
 * is CHOSEN, and chosen reads as the accent wash everywhere else in this kit. Seg keeps
 * panel/ink for the tab it is.
 *
 * `--aether-selected*` rather than `--aether-cool*`, which is where this departs from the dead
 * block's literal text: the two resolve to the same colour (the kit defines --aether-selected as
 * var(--aether-cool)) but only one of them says WHY it is that colour. Chip uses the selected
 * tokens; a radio's active option is the same idea and should move with them if a host ever
 * separates selection from the cool accent. */
.aether-radiogroup {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.aether-radiogroup button {
  border: 1px solid var(--aether-line-strong);
  background: var(--aether-surface);
  color: var(--aether-ink-soft);
  border-radius: var(--aether-radius);
  padding: 5px 11px;
  font-size: 12.5px;
  font-family: inherit;
  cursor: pointer;
}
.aether-radiogroup button.on {
  background: var(--aether-selected-wash);
  color: var(--aether-selected);
  /* currentColor, as Chip does: the active border follows the text colour rather than being a
     second thing to keep in step with it. */
  border-color: currentColor;
  /* The one line the dead accent block did not carry, kept because BOTH the shipped look and Chip
     set it: weight is the part of "chosen" that survives when colour does not — a monochrome
     print, a high-contrast mode, or an option whose own colour is close to the ink. */
  font-weight: 600;
}
.aether-radiogroup button:disabled {
  cursor: default;
  opacity: 0.55;
}
/* The kit's ring, carried over unchanged. It was already there — ui-kit.css named
   `.aether-property-editor__buttons button:focus-visible` in the shared block — so this is the
   same declaration under the new selector, at the OUTSIDE offset that block gives standalone
   controls. The inset variant beside it exists only for `.aether-seg`, which clips its children's
   corners with `overflow: hidden`; nothing clips this group, so outside is right. */
.aether-radiogroup button:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 2px;
}
</style>
