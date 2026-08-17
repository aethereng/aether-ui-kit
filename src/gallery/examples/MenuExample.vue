<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Menu from '@aether/ui-kit/controls/menu'
import type { MenuItem } from '@aether/ui-kit/controls/core'

const dirty = ref(false)

/* Items are DATA, and `disabled` is the caller's judgement — the kit never decides that "Save as"
   is unavailable, it just renders and skips it. Arrow keys pass over a disabled row rather than
   landing on it, which is the difference between a menu and a list of buttons. */
const items = ref<MenuItem[]>([
  { id: 'new', label: 'New model' },
  { id: 'open', label: 'Open…' },
  { id: 'sep1', label: '', separator: true },
  { id: 'save', label: 'Save' },
  { id: 'saveas', label: 'Save as…', disabled: true },
  { id: 'sep2', label: '', separator: true },
  { id: 'export', label: 'Export CSV' },
])

const last = ref<string | null>(null)
function onSelect(id: string) {
  last.value = id
  if (id === 'save') dirty.value = false
}
</script>

<template>
  <div class="g-menu">
    <!-- Try the keyboard: Down opens onto the first item, Up onto the last, typing jumps by label
         and repeating a letter cycles through matches, Home/End reach the ends, Escape closes and
         returns focus here, Tab closes and moves on. All of that is controls/core/menu.ts. -->
    <Menu :items="items" label="File" @select="onSelect" />

    <Menu :items="items" label="Aligned right" align="end" @select="onSelect" />

    <code class="g-ex-state">last selected = {{ last ?? '—' }}</code>
  </div>
</template>

<style scoped>
.g-menu {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
