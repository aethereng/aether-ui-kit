<script setup lang="ts">
/* A transient status pill: a short confirmation of something the user just did, which fades
 * itself out. Extracted after three surfaces shipped it byte-identically -- same fixed
 * bottom-centre pill, same fade+lift transition, same 1700ms dismissal, same one-string
 * payload. The tell was that the three hosts had already merged their CSS into a single
 * shared rule keyed off three different ids; only the four lines of timer logic stayed
 * copied, once per host.
 *
 * Controlled, like the rest of the kit: the caller owns the message. Passing a non-empty
 * string shows the toast; the component clears it by emitting an update, so the caller's
 * state stays the single source of truth and a host can dismiss early by setting ''.
 *
 * Not a queue and not a notification centre. If a second message arrives while one is up it
 * replaces it and the timer restarts -- which is what all three hosts already did, and what
 * you want for "Copied", "Queued", "Saved". */
import { ref, watch, onBeforeUnmount } from 'vue'

const props = withDefaults(
  defineProps<{
    /** The message. Empty string = hidden. */
    modelValue: string
    /** How long it stays up, in ms. */
    duration?: number
  }>(),
  { duration: 1700 },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

/* Rendered whenever there IS a message, but `on` (which drives opacity/transform) is set a
 * beat later so the CSS transition has two states to move between -- set both at once and the
 * element is simply born at its final opacity with no fade. */
const on = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.modelValue,
  (msg) => {
    clearTimeout(timer)
    if (!msg) { on.value = false; return }
    // re-trigger on a REPLACEMENT message too, not just on first show
    on.value = false
    requestAnimationFrame(() => { if (props.modelValue) on.value = true })
    timer = setTimeout(() => emit('update:modelValue', ''), props.duration)
  },
  { immediate: true },
)

// a pending timer that fires after teardown would emit into a dead component
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <!-- aria-live so a screen reader announces it; the pill is never focusable and never
       intercepts a click, so it can sit over any surface safely -->
  <div v-if="modelValue" class="aether-toast" :class="{ on }" role="status" aria-live="polite">
    {{ modelValue }}
  </div>
</template>
