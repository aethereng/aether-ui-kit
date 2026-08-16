<script setup lang="ts">
/* A dropdown menu. Same platform story as Tooltip — `popover` for the top layer, CSS anchor
 * positioning for placement — with one addition: `popover="auto"` also gives light-dismiss, so a
 * click anywhere outside closes it without a document listener that has to be added, removed, and
 * taught not to fire on the opening click.
 *
 * The keyboard model is NOT here. It is in controls/core/menu.ts as pure functions, for the same
 * reason the tree's is: arrows wrap, disabled items are skipped rather than landed on, Home/End are
 * not optional, and Tab closes rather than walking into the surface. Every one of those is a thing
 * a hand-rolled menu forgets, and none of them need a browser to test. */
import { nextTick, ref, useId, watch } from 'vue'
import { typeahead } from '../core/tree'
import { firstItem, isTypeaheadKey, lastItem, menuKey } from '../core/menu'
import type { MenuItem } from '../core/menu'

const props = withDefaults(
  defineProps<{
    items: MenuItem[]
    /** Trigger text. The #trigger slot replaces the whole button when a caller needs an icon. */
    label?: string
    placement?: 'bottom' | 'top'
    /** Aligns the surface to the trigger's start or end edge. */
    align?: 'start' | 'end'
  }>(),
  { label: 'Menu', placement: 'bottom', align: 'start' },
)

const emit = defineEmits<{ select: [id: string] }>()

const surface = ref<HTMLElement | null>(null)
const anchorEl = ref<HTMLElement | null>(null)
const open = ref(false)
const cursor = ref<string | null>(null)
const id = `aether-menu-${useId()}`
const anchorName = `--${id}`
const supportsAnchor =
  typeof CSS !== 'undefined' && CSS.supports?.('position-anchor: --a') === true
/* Optional-called for the same reason as Tooltip's: jsdom has no popover API, and an unguarded
   showPopover throws on mount in any consumer's test. Without it the surface falls back to the
   `is-open` class for visibility and loses only light-dismiss, which onSurfaceKey already covers
   for Escape and Tab. */
const supportsPopover =
  typeof HTMLElement !== 'undefined' &&
  Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'popover')

/* Typeahead buffer. Cleared on a pause so "fi" then later "l" searches for "l", not "fil" —
   without the reset, a menu becomes progressively harder to navigate the longer it stays open. */
let buffer = ''
let bufferTimer: ReturnType<typeof setTimeout> | null = null
function pushBuffer(ch: string) {
  if (bufferTimer) clearTimeout(bufferTimer)
  buffer += ch
  bufferTimer = setTimeout(() => (buffer = ''), 600)
  return buffer
}

function show(cursorAt: string | null) {
  if (supportsPopover) surface.value?.showPopover()
  open.value = true
  cursor.value = cursorAt
  focusCursor()
}

/* Found rather than reffed, because a caller supplying #trigger replaces the default button
   entirely — a ref bound inside the fallback content is null in exactly that case, which is when
   focus return matters just as much. */
function triggerEl(): HTMLElement | null {
  return anchorEl.value?.querySelector<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  ) ?? null
}

function hide(returnFocus = true) {
  if (!open.value) return
  if (supportsPopover) surface.value?.hidePopover()
  open.value = false
  cursor.value = null
  /* Returning focus to the trigger is what makes Escape feel like "back" rather than "lost". The
     browser does this for a modal <dialog> and does NOT do it for a popover. */
  if (returnFocus) triggerEl()?.focus()
}

/* Menus move real DOM focus rather than using aria-activedescendant: it is what the APG pattern
   specifies, and it means Enter and Space land on the focused element with no extra wiring.
   It is also load-bearing for dismissal — opening by MOUSE and leaving focus on the trigger put
   the keydown handler out of reach, so Escape did nothing. Every open lands on an item. */
async function focusCursor() {
  await nextTick()
  if (!cursor.value) return
  surface.value?.querySelector<HTMLElement>(`[data-mid="${CSS.escape(cursor.value)}"]`)?.focus()
}

function onTriggerKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    show(firstItem(props.items))
  } else if (e.key === 'ArrowUp') {
    // Opening upward lands on the last item, so the nearest item to the pointer is the first hit.
    e.preventDefault()
    show(lastItem(props.items))
  }
}

function onSurfaceKey(e: KeyboardEvent) {
  const r = menuKey(props.items, e.key, cursor.value)
  if (r.kind === 'move') {
    e.preventDefault()
    cursor.value = r.id!
    focusCursor()
    return
  }
  if (r.kind === 'activate') {
    e.preventDefault()
    select(r.id!)
    return
  }
  if (r.kind === 'close') {
    /* Escape is consumed; Tab is NOT. Tab should close the menu and then move focus onward the way
       it normally would, so preventing it would trap the user in the surface it just closed. */
    if (e.key === 'Escape') e.preventDefault()
    hide(e.key === 'Escape')
    return
  }
  if (isTypeaheadKey(e.key)) {
    const hit = typeahead(props.items, pushBuffer(e.key), cursor.value ?? '')
    if (hit) {
      e.preventDefault()
      cursor.value = hit
      focusCursor()
    }
  }
}

function select(itemId: string) {
  const item = props.items.find((i) => i.id === itemId)
  if (!item || item.disabled || item.separator) return
  emit('select', itemId)
  hide()
}

/* The browser can close an `auto` popover on its own — a click outside, or another popover opening.
   Without this the component's state would drift out of step with what is on screen. */
function onToggle(e: Event) {
  const newState = (e as ToggleEvent).newState
  if (newState === 'closed' && open.value) {
    open.value = false
    cursor.value = null
  }
}

/* Same reason as Tooltip's: the wrapper is `display: contents` and so generates no box, and an
   element with no box cannot be an anchor — named there, the surface falls back to the viewport
   corner. It goes on the trigger, found rather than reffed so a caller's own #trigger works too. */
watch(
  [anchorEl, () => props.items],
  () => {
    if (supportsAnchor) triggerEl()?.style.setProperty('anchor-name', anchorName)
  },
  { flush: 'post' },
)

watch(() => props.items, () => {
  // An item removed under the cursor would otherwise leave focus pointing at nothing.
  if (cursor.value && !props.items.some((i) => i.id === cursor.value)) cursor.value = firstItem(props.items)
})
</script>

<template>
  <span ref="anchorEl" class="aether-menu__anchor">
    <slot name="trigger" :open="open" :toggle="() => (open ? hide() : show(firstItem(items)))">
      <button
        type="button"
        class="aether-menu__trigger"
        :aria-haspopup="'menu'"
        :aria-expanded="open"
        :aria-controls="id"
        @click="open ? hide(false) : show(firstItem(items))"
        @keydown="onTriggerKey"
      >
        {{ label }}
      </button>
    </slot>

    <div
      :id="id"
      ref="surface"
      popover="auto"
      role="menu"
      class="aether-menu"
      :class="[`aether-menu--${placement}`, `aether-menu--${align}`, { 'is-open': open }]"
      :style="supportsAnchor ? { positionAnchor: anchorName } : { position: 'fixed' }"
      @keydown="onSurfaceKey"
      @toggle="onToggle"
    >
      <template v-for="item in items" :key="item.id">
        <hr v-if="item.separator" class="aether-menu__sep" role="separator" />
        <button
          v-else
          type="button"
          role="menuitem"
          class="aether-menu__item"
          :data-mid="item.id"
          :disabled="item.disabled"
          :tabindex="cursor === item.id ? 0 : -1"
          @click="select(item.id)"
        >
          <slot name="item" :item="item">{{ item.label }}</slot>
        </button>
      </template>
    </div>
  </span>
</template>

<style scoped>
.aether-menu__anchor {
  display: contents;
}
.aether-menu {
  margin: 0;
  padding: 4px;
  border: 1px solid var(--aether-line-strong);
  border-radius: 9px;
  background: var(--aether-surface);
  color: var(--aether-ink);
  box-shadow: var(--aether-shadow);
  min-width: 168px;
  font: inherit;
}
/* See Tooltip: only where `popover` is inert, and guarded this way round so it cannot outrank the
   UA's own `[popover]:popover-open` rule where the attribute does work. */
@supports not selector(:popover-open) {
  .aether-menu {
    display: none;
  }
  .aether-menu.is-open {
    display: block;
    position: fixed;
  }
}
@supports (position-anchor: --a) {
  .aether-menu {
    position: fixed;
    margin: 4px;
    position-try-fallbacks: flip-block;
  }
  .aether-menu--bottom.aether-menu--start {
    position-area: bottom span-right;
  }
  .aether-menu--bottom.aether-menu--end {
    position-area: bottom span-left;
  }
  .aether-menu--top.aether-menu--start {
    position-area: top span-right;
  }
  .aether-menu--top.aether-menu--end {
    position-area: top span-left;
  }
}
.aether-menu__trigger {
  font: inherit;
  font-size: var(--aether-control-font-size);
  color: var(--aether-ink);
  background: var(--aether-surface);
  border: 1px solid var(--aether-line-strong);
  border-radius: var(--aether-radius, 7px);
  padding: 5px 10px;
  cursor: pointer;
}
.aether-menu__trigger:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 2px;
}
.aether-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 9px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--aether-ink);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.aether-menu__item:hover:not(:disabled),
.aether-menu__item:focus-visible {
  background: var(--aether-selected-wash);
  color: var(--aether-selected);
  outline: none;
}
.aether-menu__item:disabled {
  color: var(--aether-faint);
  cursor: default;
}
.aether-menu__sep {
  margin: 4px 2px;
  border: 0;
  border-top: 1px solid var(--aether-line);
}
</style>
