<script setup lang="ts">
/* An icon that puts words on the clipboard and says how that went.
 *
 * Icon only, so it can end a line of text without taking a column: a Tool with its label hidden, and
 * the label standing in a Tooltip on hover and keyboard focus. `label` says what is copied ("Copy the
 * findings"). After a press the label becomes the outcome, for 1.5 s:
 *   Copied       the icon turns to a check
 *   Not copied   the icon turns to a cross; the write was refused, or the page has no clipboard
 * The outcome is never silent: it is in the accessible name, in a status region a screen reader hears
 * as it happens, and, after a press by a pointer, in the tooltip: a pointer press closes the tooltip as
 * it lands, so the control opens it again once the write is settled, and after a tap (nothing ends a
 * finger's hover) closes it with the outcome.
 *
 * On a coarse pointer the tap area is a 44 px square about the icon, drawn as a transparent
 * pseudo-element: the icon keeps its size and the square takes no room in the line it ends. */
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import Tool from './Tool.vue'
import Tooltip from './Tooltip.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  /** What a press puts on the clipboard. */
  words: string
  /** What the control copies, said at rest: its tooltip and its accessible name. */
  label: string
}>()

/** How long the control shows how the copy went, in ms. */
const SHOWN_MS = 1500
type Outcome = 'rest' | 'copied' | 'refused'

const state = ref<Outcome>('rest')
const said = computed(() => (state.value === 'copied' ? 'Copied' : state.value === 'refused' ? 'Not copied' : props.label))
const tip = ref<{ show: () => void; hide: () => void } | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
/* The pointer of the press in progress, null for a press by the keyboard (which has no pointerdown). A
   pointer press closes the tooltip as it lands, so the control opens it again once it has an outcome to
   say; a keyboard press leaves alone the tooltip that focus opened. */
let pressedBy: string | null = null
// Whether a finger's tap opened the tooltip: nothing ends a finger's hover, so it is closed with the outcome.
let opened = false

function onPointerDown(e: PointerEvent) {
  pressedBy = e.pointerType
}

async function copy(): Promise<void> {
  const by = pressedBy
  pressedBy = null
  let done: 'copied' | 'refused'
  try {
    await navigator.clipboard.writeText(props.words)
    done = 'copied'
  } catch {
    done = 'refused'
  }
  state.value = done
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    state.value = 'rest'
    timer = null
    if (opened) tip.value?.hide()
    opened = false
  }, SHOWN_MS)
  if (by !== null) {
    // after the outcome's words are in the tooltip, so a tooltip placed by measuring measures them
    await nextTick()
    if (timer === null) return
    tip.value?.show()
    opened = by === 'touch'
  }
}

onBeforeUnmount(() => {
  if (timer !== null) clearTimeout(timer)
})
</script>

<template>
  <Tooltip ref="tip" :text="said" placement="top">
    <Tool
      v-bind="$attrs"
      :label="said"
      label-hidden
      class="aether-copy"
      :class="{ 'aether-copy--done': state === 'copied', 'aether-copy--refused': state === 'refused' }"
      @pointerdown="onPointerDown"
      @click="copy"
    >
      <template #icon>
        <svg v-if="state === 'copied'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M3 8.5 6.5 12 13 4.5" />
        </svg>
        <svg v-else-if="state === 'refused'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
        <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6.5a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1h.5" />
        </svg>
      </template>
    </Tool>
  </Tooltip>
  <span class="aether-copy-status" role="status">{{ state === 'rest' ? '' : said }}</span>
</template>

<style scoped>
/* Quiet at rest: the icon alone, its frame shown on hover and focus. */
.aether-copy {
  position: relative;
  flex: 0 0 auto;
  padding: 3px;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  font-size: 14px;
  /* A Tool grows to the touch floor on a coarse pointer; this one keeps the icon's size and gets its
     tap area from the pseudo-element below. */
  min-height: 0;
}
.aether-copy:hover {
  border-color: var(--aether-line-strong);
  color: var(--aether-ink);
}
.aether-copy--done {
  color: var(--aether-cool);
}
.aether-copy--refused {
  color: var(--aether-tone-danger);
}
@media (pointer: coarse) {
  .aether-copy::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--aether-touch);
    height: var(--aether-touch);
    transform: translate(-50%, -50%);
  }
}

/* Visually hidden but in the accessibility tree: the outcome is read, as it happens, to a screen reader. */
.aether-copy-status {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
</style>
