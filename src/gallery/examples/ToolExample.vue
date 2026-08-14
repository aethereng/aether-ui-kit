<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Tool from '@aether/ui-kit/controls/tool'

const clicks = ref(0)

/* A closed variant set rather than an open style hook. If both `hot` and `danger` are passed,
   danger wins — mislabelling a destructive action as primary is the worse failure, so the
   component decides rather than leaving it to declaration order. */
</script>

<template>
  <div class="g-ex">
    <span class="g-variant">hot — the primary action on a surface</span>
    <Tool label="New card" hot @click="clicks++" />
  </div>

  <div class="g-ex">
    <span class="g-variant">default — neutral</span>
    <Tool label="Plain" @click="clicks++" />
  </div>

  <div class="g-ex">
    <span class="g-variant">danger — destructive</span>
    <Tool label="Delete" danger @click="clicks++" />
  </div>

  <div class="g-ex">
    <span class="g-variant">disabled — emits nothing</span>
    <Tool label="Disabled" disabled @click="clicks++" />
  </div>

  <div class="g-ex">
    <span class="g-variant">both hot and danger — danger wins</span>
    <Tool label="Discard all" hot danger title="danger takes precedence" @click="clicks++" />
  </div>

  <code class="g-ex-state">clicks = {{ clicks }}</code>
</template>
