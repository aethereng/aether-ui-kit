<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Switch from '@aether/ui-kit/controls/switch'

const gravity = ref(true)
const edges = ref(false)
const locked = ref(true)

/* A count beside the name, which is what a layer panel wants and what a schema-driven form has
   nowhere to put. Standalone, the label is ordinary markup and the caller decides its shape. */
const solids = 4812
</script>

<template>
  <div class="g-sw">
    <!-- The switch is one bare input and owns no label. Association is the caller's, exactly as
         it is inside PropertyEditor — which lets a label carry whatever the surface needs. -->
    <div class="g-sw-row">
      <Switch id="sw-gravity" v-model="gravity" />
      <label for="sw-gravity">Gravity</label>
    </div>

    <div class="g-sw-row">
      <Switch id="sw-ifc" v-model="edges" />
      <label for="sw-ifc">Raw samples <span class="g-sw-n">{{ solids }}</span></label>
    </div>

    <div class="g-sw-row">
      <Switch id="sw-locked" v-model="locked" disabled />
      <label for="sw-locked">Locked while the run is active</label>
    </div>

    <code class="g-ex-state">gravity = {{ gravity }} · edges = {{ edges }}</code>
  </div>
</template>

<style scoped>
.g-sw {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}
.g-sw-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.g-sw-row label {
  font-size: 13px;
  font-weight: 500;
  color: var(--aether-ink);
}
.g-sw-n {
  margin-left: 4px;
  font-size: 12px;
  color: var(--aether-ink-soft);
}
</style>
