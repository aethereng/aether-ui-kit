<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE: rendered as the demo and sliced for the Template/Script tabs. */
import CopyButton from '@aether/ui-kit/controls/copy-button'
import Tooltip from '@aether/ui-kit/controls/tooltip'

const words = 'Combination 6: utilisation 0.92 at member 14, station 0.5, governed by bending about the major axis.'
</script>

<template>
  <div class="g-cb-line">
    <Tooltip :text="words" placement="top">
      <span class="g-cb-label" tabindex="0">Combination 6: 0.92</span>
    </Tooltip>
    <CopyButton :words="words" label="Copy the words" />
  </div>
</template>

<style scoped>
.g-cb-line {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}
.g-cb-label {
  font-size: var(--aether-control-font-size);
  color: var(--aether-ink);
  cursor: help;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
.g-cb-label:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 2px;
  border-radius: 2px;
}
</style>
