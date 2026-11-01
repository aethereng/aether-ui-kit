<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE: rendered as the demo and sliced for the Template/Script tabs. */
import { computed, ref } from 'vue'
import Checkbox from '@aether/ui-kit/controls/checkbox'

const layers = ref([
  { name: 'Rivers', on: true },
  { name: 'Roads', on: true },
  { name: 'Contours', on: false },
])

/* The group's own key says what its rows say. The caller works it out and the control only draws it. */
const onCount = computed(() => layers.value.filter((l) => l.on).length)
const all = computed(() => onCount.value === layers.value.length)
const some = computed(() => onCount.value > 0 && !all.value)

function setAll(on: boolean) {
  for (const l of layers.value) l.on = on
}

const locked = ref(true)
const large = ref(true)
</script>

<template>
  <div class="g-cb">
    <Checkbox :model-value="all" :mixed="some" @update:model-value="setAll">All layers</Checkbox>

    <div class="g-cb-rows">
      <Checkbox v-for="l in layers" :key="l.name" v-model="l.on">{{ l.name }}</Checkbox>
      <Checkbox v-model="locked" disabled>Boundaries, locked by the map</Checkbox>
    </div>

    <!-- Off, on and partly on at each size. `label` names a key with no words beside it. -->
    <div v-for="size in [16, 20, 24]" :key="size" class="g-cb-sizes">
      <Checkbox :model-value="false" :size="size" :label="`Off at ${size}px`" />
      <Checkbox :model-value="true" :size="size" :label="`On at ${size}px`" />
      <Checkbox :model-value="false" mixed :size="size" :label="`Partly on at ${size}px`" />
    </div>

    <Checkbox v-model="large" :size="20">Twenty pixels, with its label</Checkbox>

    <code class="g-ex-state">{{ onCount }} of {{ layers.length }} on</code>
  </div>
</template>

<style scoped>
.g-cb {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}
.g-cb-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  padding-left: 23px;
}
.g-cb-sizes {
  display: flex;
  align-items: center;
  gap: 14px;
}
</style>
