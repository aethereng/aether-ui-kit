<script setup lang="ts">
/* An icon drawn from an SVG path string on a 24 by 24 grid, the form `@mdi/js` exports.
 *
 * THE KIT SHIPS NO ICON SET. The caller imports its own path constant and hands it here, so the
 * set (and its version) stays the app's dependency, tree-shaken, with no icon font. Kit controls
 * still take icons through an `#icon` slot; this is what an app puts in it.
 *
 * Sized in `em` by default, so it follows the text it sits in: a Tool's slotted icon lands at the
 * button's size without either side knowing about the other. `size` sets another length; a number
 * is pixels.
 *
 * `label` IS THE ACCESSIBILITY CONTRACT, as Spinner's is. With none the icon is decoration and
 * `aria-hidden`, which is right where a control's own label or visible text already names it. With
 * one the icon is an image of that name. */

const props = withDefaults(
  defineProps<{
    /** The path's `d`, on a 24 by 24 grid. */
    path: string
    /** Width and height, as a CSS length; a number is pixels. Default 1em. */
    size?: number | string
    /** Accessible name. Omit when the control or text beside the icon already names it. */
    label?: string
  }>(),
  { size: undefined, label: undefined },
)

const length = (): string | undefined => (typeof props.size === 'number' ? `${props.size}px` : props.size)
</script>

<template>
  <svg
    class="aether-icon"
    viewBox="0 0 24 24"
    fill="currentColor"
    focusable="false"
    :style="size === undefined ? undefined : { width: length(), height: length() }"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <path :d="path" />
  </svg>
</template>

<style scoped>
.aether-icon {
  width: 1em;
  height: 1em;
  display: block;
  flex: none;
}
</style>
