<script setup lang="ts" generic="T">
/* Thin Vue wrapper over the tree core. All the keyboard logic lives in ../core/tree — this file
 * owns rendering, focus and emits, and decides nothing about what an arrow key means.
 *
 * CONTROLLED, like the rest of the kit: the caller owns `expanded` and `selected`. Both consumers
 * keep tree state in a store and persist it, which a self-managing tree cannot express.
 *
 * Rendered FLAT rather than as nested lists. ARIA explicitly allows a flattened tree as long as each
 * item carries aria-level/setsize/posinset, and flat is what makes virtualisation possible later
 * without redoing the markup. It also keeps the roving tabindex to a single list.
 *
 * Emits:
 *   update:expanded — (string[]) the new expanded set
 *   select          — (id, node) a row was activated by click, Enter or Space
 */
import { computed, nextTick, ref, watch } from 'vue'
import { treeKey, typeahead, visibleRows, type TreeNode, type TreeRow } from '../core/tree'

const props = withDefaults(
  defineProps<{
    nodes: TreeNode<T>[]
    /** Ids of the open nodes. The caller owns this. */
    expanded?: string[]
    selected?: string | null
    ariaLabel?: string
    /** Indent per level, in px. The kit picks a default rather than a token because indentation is
     *  structural rhythm, not palette. */
    indent?: number
  }>(),
  { expanded: () => [], selected: null, ariaLabel: 'Tree', indent: 14 },
)

const emit = defineEmits<{
  'update:expanded': [string[]]
  select: [id: string, node: TreeNode<T>]
}>()

defineSlots<{
  /** Replace a row's content. Receives the row, so a caller can render badges, counts, icons.
   *  Anything focusable in here would break the roving tabindex — put controls outside the tree. */
  row?: (props: { row: TreeRow<T> }) => unknown
}>()

const openSet = computed(() => new Set(props.expanded))
const rows = computed(() => visibleRows(props.nodes, openSet.value))

/* The cursor is NOT the selection. Arrowing through a tree moves a focus ring without committing
 * anything — a tree where every arrow key fired `select` would load a file per keypress. */
const cursor = ref<string | null>(null)
const root = ref<HTMLElement | null>(null)

const cursorId = computed(() => {
  const list = rows.value
  if (cursor.value && list.some((r) => r.id === cursor.value)) return cursor.value
  // Fall back to the selection, then to the first row: the cursor must always land somewhere real,
  // or the tree has no tabbable element and Tab skips it entirely.
  if (props.selected && list.some((r) => r.id === props.selected)) return props.selected
  return list[0]?.id ?? null
})

// Collapsing an ancestor can strand the cursor inside a hidden subtree.
watch(rows, (list) => {
  if (cursor.value && !list.some((r) => r.id === cursor.value)) cursor.value = null
})

function focusCursor() {
  root.value?.querySelector<HTMLElement>('[data-cursor="true"]')?.focus()
}
function moveTo(id: string) {
  cursor.value = id
  nextTick(focusCursor)
}
function setExpanded(id: string, open: boolean) {
  const next = new Set(props.expanded)
  if (open) next.add(id)
  else next.delete(id)
  emit('update:expanded', [...next])
}
function activate(id: string) {
  const row = rows.value.find((r) => r.id === id)
  if (row) emit('select', id, row.node)
}

/* Typeahead buffer. Cleared on a pause so "ro" then later "a" does not search for "roa". */
let buffer = ''
let bufferTimer: ReturnType<typeof setTimeout> | undefined
function pushTypeahead(ch: string) {
  clearTimeout(bufferTimer)
  buffer += ch
  bufferTimer = setTimeout(() => (buffer = ''), 500)
  const hit = typeahead(rows.value, buffer, cursorId.value ?? '')
  if (hit) moveTo(hit)
}

function onKey(e: KeyboardEvent) {
  const id = cursorId.value
  if (!id) return

  // A single printable character is typeahead; anything with a modifier belongs to the host.
  if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault()
    pushTypeahead(e.key)
    return
  }

  const result = treeKey(e.key, rows.value, id)
  if (result.kind === 'none') return
  // Only prevent default for keys we actually consumed — Space and the arrows scroll the page
  // otherwise, but an unhandled key must stay the host's.
  e.preventDefault()
  if (result.kind === 'move') moveTo(result.id)
  else if (result.kind === 'expand') setExpanded(result.id, true)
  else if (result.kind === 'collapse') setExpanded(result.id, false)
  else if (result.kind === 'activate') activate(result.id)
}

function onRowClick(id: string) {
  cursor.value = id
  activate(id)
}
function onTwisty(id: string, open: boolean) {
  setExpanded(id, !open)
}
</script>

<template>
  <div ref="root" class="aether-tree" role="tree" :aria-label="ariaLabel" @keydown="onKey">
    <!-- The row takes a click but binds no keydown of its own, and that is the correct shape rather
         than an oversight: in a roving-tabindex tree the keys MUST be handled at the tree level, on
         the container above, because the whole point is that only one row is focusable and it
         changes. Binding keydown per row would attach handlers to elements that cannot receive
         focus. The rule cannot see an ancestor's listener, so it reads this as mouse-only when the
         keyboard path is the better one. (`no-static-element-interactions` correctly stays silent
         here — role="treeitem" is interactive.) -->
    <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events -->
    <div
      v-for="row in rows"
      :key="row.id"
      class="aether-tree__row"
      :class="{ 'is-selected': row.id === selected }"
      role="treeitem"
      :aria-level="row.level"
      :aria-setsize="row.setSize"
      :aria-posinset="row.posInSet"
      :aria-expanded="row.hasChildren ? row.expanded : undefined"
      :aria-selected="row.id === selected"
      :tabindex="row.id === cursorId ? 0 : -1"
      :data-cursor="row.id === cursorId"
      :data-id="row.id"
      :style="{ paddingLeft: 6 + (row.level - 1) * indent + 'px' }"
      @click="onRowClick(row.id)"
      @focus="cursor = row.id"
    >
      <!-- The twisty is a plain span, not a button, and that is deliberate: a treeitem must not
           contain its own focusable element or the roving tabindex breaks and screen readers
           announce a control inside a control. It is a MOUSE affordance — the keyboard path is
           ArrowRight/ArrowLeft on the row itself, handled above. Hence the lint exemption: the
           keyboard equivalent exists, it just is not bound here. -->
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
      <span
        class="aether-tree__twisty"
        :class="{ 'is-open': row.expanded, 'is-leaf': !row.hasChildren }"
        aria-hidden="true"
        @click.stop="row.hasChildren && onTwisty(row.id, row.expanded)"
      />
      <span class="aether-tree__label">
        <slot name="row" :row="row">{{ row.label }}</slot>
      </span>
    </div>
  </div>
</template>

<style scoped>
/* Scoped, not in ui-kit.css: that sheet is imported wholesale by every consumer, so a component
   that puts its CSS there charges everyone for it whether they render a tree or not. */
.aether-tree {
  display: flex;
  flex-direction: column;
}
.aether-tree__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 6px;
  border-radius: 5px;
  color: var(--aether-ink);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
.aether-tree__row:hover {
  background: var(--aether-panel);
}
.aether-tree__row:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: -2px;
}
.aether-tree__row.is-selected {
  background: var(--aether-cool-wash);
  color: var(--aether-cool);
  font-weight: 650;
}
/* Same border triangle as Disclosure's, for the same reasons: font-independent, crisp, tokenised. */
.aether-tree__twisty {
  flex: none;
  width: 0;
  height: 0;
  margin-left: 2px;
  margin-right: 2px;
  border-left: 5px solid currentColor;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  color: var(--aether-ink-soft);
  transition: transform 0.15s ease;
}
.aether-tree__twisty.is-open {
  transform: rotate(90deg);
}
/* A leaf keeps the twisty's BOX so labels stay aligned down the column, but draws nothing. */
.aether-tree__twisty.is-leaf {
  border-left-color: transparent;
  cursor: default;
}
.aether-tree__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (pointer: coarse) {
  .aether-tree__row {
    min-height: var(--aether-touch-dense);
  }
}
</style>
