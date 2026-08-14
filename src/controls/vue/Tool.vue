<script setup lang="ts">
/* Thin Vue wrapper over the Tool primitive. A header action button used across
 * every surface that has a header. Click handler is the caller's; this wrapper owns only
 * presentation + emit.
 *
 * Three variants, deliberately a closed set rather than an open style hook:
 *   default — a neutral action
 *   hot     — the primary action on a surface
 *   danger  — a destructive action (delete, discard)
 * `hot` and `danger` are mutually exclusive in practice; if both are passed,
 * danger wins, because mislabelling a destructive action as primary is the
 * worse failure.
 *
 * There is deliberately NO active/pressed state. Tool is a STATELESS COMMAND, and that is the
 * line between it and Seg (one selected option) -- `.aether-button-group` exists in ui-kit.css
 * precisely because a joined row of commands is not a segmented control, and the touch-target
 * block leans on that same split. A control where several things can be simultaneously on is
 * Chip's contract already (`modelValue: V | Set<V>`, `toggle`), not this one.
 *
 * `#icon` is a SLOT rather than an `icon` prop on purpose: a prop implies an icon vocabulary,
 * and zero runtime dependencies is load-bearing for this kit. A slot lets the caller bring their
 * own SVG and costs the kit nothing. `label` stays required even for an icon-only button -- it
 * becomes the accessible name via aria-label, so an icon button is never unlabelled to a screen
 * reader. Pass `labelHidden` to render the icon alone. */
withDefaults(
  defineProps<{
    label: string
    hot?: boolean
    danger?: boolean
    disabled?: boolean
    title?: string
    /** Render only the `#icon` slot, keeping `label` as the accessible name. Without an icon
     *  slot this would produce an empty button, so it is ignored unless one is supplied. */
    labelHidden?: boolean
  }>(),
  { title: undefined, labelHidden: false },
)

const emit = defineEmits<{
  click: []
}>()

const slots = defineSlots<{
  /** Leading icon. The caller's own markup -- an inline SVG, a font glyph, anything. */
  icon?: () => unknown
}>()
</script>

<template>
  <button
    type="button"
    :class="{
      'aether-tool': true,
      hot: !!hot && !danger,
      danger: !!danger,
      'aether-tool--icon': !!slots.icon,
      'aether-tool--icon-only': !!slots.icon && labelHidden,
    }"
    :disabled="disabled"
    :title="title"
    :aria-label="slots.icon && labelHidden ? label : undefined"
    @click="emit('click')"
  >
    <span v-if="slots.icon" class="aether-tool__icon" aria-hidden="true"><slot name="icon" /></span>
    <!-- labelHidden is honoured only alongside an icon: hiding the label of a button with no
         icon would render an empty control. -->
    <span v-if="!(slots.icon && labelHidden)">{{ label }}</span>
  </button>
</template>
