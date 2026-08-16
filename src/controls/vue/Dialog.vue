<script setup lang="ts">
/* A modal dialog, which is mostly a thin wrapper over <dialog> because the platform already does
 * the expensive parts. `showModal()` gives the top layer (so nothing an ancestor clips can clip
 * this), a real focus trap, `inert` on everything behind it, Escape-to-close, `::backdrop`, and
 * focus returned to whatever opened it. None of that is reimplemented here.
 *
 * What IS here: keeping the element in step with a controlled `open` prop, closing on a backdrop
 * click, and locking page scroll — the one thing showModal() does not do. */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Accessible name for the dialog. Rendered as the heading unless the #title slot replaces it. */
    title?: string
    /** Matches the widest call site seen in the wild; a caller with different content overrides it. */
    maxWidth?: string
    /** Escape and backdrop clicks close it. Set false for a dialog with unsaved work in it, and
     *  give the user an explicit way out — a dialog with no exit is worse than a dismissible one. */
    dismissible?: boolean
  }>(),
  { title: undefined, maxWidth: '720px', dismissible: true },
)

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const el = ref<HTMLDialogElement | null>(null)
let restoreOverflow: string | null = null

/* showModal() throws InvalidStateError if the dialog is already open, and close() on a closed
   dialog fires a spurious `close` event — so both are guarded on the element's own state rather
   than on the prop, which can be set to what it already is. */
/* showModal is optional-called because it does not exist everywhere the component might be
   constructed — jsdom has <dialog> but not showModal, so an unguarded call throws on mount and
   takes down any consumer's test that renders a dialog. Setting `open` is the degraded path: a
   non-modal dialog is still visible and still closes, it simply loses the top layer and the trap. */
function sync(open: boolean) {
  const d = el.value
  if (!d) return
  if (open && !d.open) {
    if (typeof d.showModal === 'function') d.showModal()
    else d.open = true
    /* The one gap in the native behaviour: the page behind a modal still scrolls. Storing the
       previous value rather than assuming '' matters for a host that already had it set. */
    restoreOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else if (!open && d.open) {
    if (typeof d.close === 'function') d.close()
    else d.open = false
    /* Unconditional, and NOT left to the `close` event. Measured in Chrome 148: showModal()
       followed by close() fires no `close` event at all — not synchronously, not after a task —
       so a component that cleans up there leaves the page permanently unscrollable. release() is
       idempotent, so the handler below can also call it without doing this twice. */
    release()
  }
}

watch(() => props.open, sync)
/* onMounted, not a watcher on the template ref: a ref watcher fires on the tick AFTER the element
   is assigned, so a dialog mounted with open=true would spend one frame closed and any test
   asserting straight after mount would see it shut. */
onMounted(() => props.open && sync(true))

function release() {
  if (restoreOverflow !== null) {
    document.body.style.overflow = restoreOverflow
    restoreOverflow = null
  }
}

/* Fires for Escape AND for close(). Cancelling a non-dismissible dialog has to preventDefault on
   `cancel` specifically — by the time `close` fires it has already gone. */
/* `cancel` is Escape, and it is the RELIABLE half of the pair: the browser fires it before closing,
   it is cancelable, and unlike `close` it actually arrives. So the state sync for a
   browser-initiated close hangs off this rather than off `close`. */
function onCancel(e: Event) {
  if (!props.dismissible) {
    e.preventDefault()
    return
  }
  release()
  emit('update:open', false)
}
function onClose() {
  release()
  emit('update:open', false)
}

/* A click on the backdrop lands on the <dialog> ELEMENT, not on any child — the backdrop is its
   pseudo-element and has no separate hit target. So "outside" means outside the element's own
   content box, which is what this compares. Without the rect check, a click on the padding would
   read as a backdrop click. */
function onClick(e: MouseEvent) {
  const d = el.value
  if (!d || !props.dismissible || e.target !== d) return
  const r = d.getBoundingClientRect()
  const outside =
    e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
  if (outside) emit('update:open', false)
}

// A dialog unmounted while open would leave the page permanently unscrollable.
onBeforeUnmount(release)
</script>

<template>
  <!-- The rule does not know a dialog element is interactive. The handler implements BACKDROP
       dismissal, which has no keyboard equivalent to add: Escape already closes a modal dialog
       natively and is handled above via `cancel`. A keyboard listener here would either duplicate
       that or invent a second way to do the same thing. -->
  <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
  <dialog
    ref="el"
    class="aether-dialog"
    :style="{ maxWidth }"
    :aria-label="title"
    @cancel="onCancel"
    @close="onClose"
    @click="onClick"
  >
    <div class="aether-dialog__head">
      <slot name="title"><h2 v-if="title">{{ title }}</h2></slot>
      <button
        v-if="dismissible"
        type="button"
        class="aether-dialog__x"
        aria-label="Close"
        @click="emit('update:open', false)"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </button>
    </div>

    <div class="aether-dialog__body"><slot /></div>

    <div v-if="$slots.footer" class="aether-dialog__foot"><slot name="footer" /></div>
  </dialog>
</template>

<style scoped>
.aether-dialog {
  /* width, not max-width: max-width is bound inline so a caller can change it. */
  width: calc(100vw - 32px);
  padding: 0;
  border: 1px solid var(--aether-line-strong);
  border-radius: 10px;
  background: var(--aether-surface);
  color: var(--aether-ink);
  box-shadow: var(--aether-shadow);
  font: inherit;
}
.aether-dialog::backdrop {
  /* Deliberately a literal rather than a token: ::backdrop cannot see custom properties inherited
     from the page, because it inherits from the originating element's ORIGINATING tree only in
     newer engines and from nothing in older ones. A token here silently resolves to nothing. */
  background: rgba(10, 12, 14, 0.44);
}
.aether-dialog__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 12px 12px 16px;
  border-bottom: 1px solid var(--aether-line);
}
.aether-dialog__head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
  letter-spacing: 0.01em;
}
.aether-dialog__x {
  margin-left: auto;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: var(--aether-ink-soft);
  cursor: pointer;
}
.aether-dialog__x:hover {
  color: var(--aether-ink);
  border-color: var(--aether-line-strong);
}
.aether-dialog__x:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 2px;
}
.aether-dialog__body {
  padding: 16px;
  /* The dialog itself is capped so a tall body scrolls inside rather than running off screen. */
  max-height: calc(100vh - 180px);
  overflow: auto;
}
.aether-dialog__foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--aether-line);
}
</style>
