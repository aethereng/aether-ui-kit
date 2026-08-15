<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Tree from '@aether/ui-kit/controls/tree'
import type { TreeNode } from '@aether/ui-kit/controls/core'

/* Controlled, like the rest of the kit: the caller owns `expanded` and `selected`. Both are plain
   data, so a host can persist them, restore them, or drive them from a route.

   The keyboard model lives in the framework-free core (`treeKey`), not in the component — it is the
   part that is genuinely easy to get wrong. Two arrows do two things each:
     Right  — expands a closed folder; on an already-open one, steps INTO it
     Left   — closes an open folder; on a closed one or a file, steps OUT to the parent
   Plus Up/Down across visible rows only, Home/End, Enter/Space to select, and typeahead. */
const nodes: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    children: [
      {
        id: 'components',
        label: 'components',
        children: [
          { id: 'button', label: 'Button.vue' },
          { id: 'field', label: 'Field.vue' },
        ],
      },
      { id: 'main', label: 'main.ts' },
    ],
  },
  {
    id: 'docs',
    label: 'docs',
    children: [{ id: 'guide', label: 'guide.md' }],
  },
  { id: 'readme', label: 'README.md' },
]

const expanded = ref<string[]>(['src'])
const selected = ref<string | null>('main')
</script>

<template>
  <div class="g-ex g-ex--full">
    <span class="g-variant">arrow keys move a cursor; Enter selects — moving is not selecting, so
      arrowing through a tree never fires the caller's open handler</span>
    <div class="g-tree">
      <Tree
        v-model:expanded="expanded"
        :nodes="nodes"
        :selected="selected"
        aria-label="Project files"
        @select="selected = $event"
      />
    </div>
  </div>

  <code class="g-ex-state">selected = {{ selected }} · expanded = {{ JSON.stringify(expanded) }}</code>

  <p class="g-hint">
    Tab into the tree and it takes <em>one</em> tab stop, not one per row — the focused row roves
    with the arrow keys. Type a letter to jump. Every row carries
    <code>aria-level</code>, <code>aria-setsize</code> and <code>aria-posinset</code>, which is what
    makes a flat list of rows read as a tree to a screen reader.
  </p>
</template>

<style scoped>
/* The caller owns the frame — the kit ships no panel around the tree, because a tree lives in a
   sidebar, a drawer or a card and each of those brings its own box. */
.g-tree {
  width: 100%;
  max-width: 320px;
  padding: 6px;
  border: 1px solid var(--aether-line);
  border-radius: 8px;
  background: var(--aether-surface);
}
</style>
