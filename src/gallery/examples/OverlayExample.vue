<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE: rendered as the demo and sliced for the Template/Script tabs. */
import { onBeforeUnmount, ref } from 'vue'
import Overlay from '@aether/ui-kit/controls/overlay'
import Spinner from '@aether/ui-kit/controls/spinner'
import Tool from '@aether/ui-kit/controls/tool'

/* `open` is the raw flag, true for as long as the work runs. The card decides when to show from it:
   not for work that ends inside its delay, and once shown for long enough to read. */
const open = ref(false)
const progress = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

function stop() {
  clearInterval(timer)
  open.value = false
  progress.value = null
}

/* Stands in for the app's own work. With no measure of how far along it is, `progress` stays null and
   the bar sweeps; a bar only fills where the work can report a fraction. */
function run(ms: number, measured: boolean) {
  stop()
  open.value = true
  progress.value = measured ? 0 : null
  const start = Date.now()
  timer = setInterval(() => {
    const done = (Date.now() - start) / ms
    if (done >= 1) stop()
    else if (measured) progress.value = done
  }, 100)
}

onBeforeUnmount(stop)
</script>

<template>
  <div class="g-ex g-ex--tile">
    <span class="g-variant">work that cannot say how far along it is</span>
    <Tool label="Run 3 s" hot @click="run(3000, false)" />
  </div>

  <div class="g-ex g-ex--tile">
    <span class="g-variant">work that reports a fraction</span>
    <Tool label="Run 3 s" hot @click="run(3000, true)" />
  </div>

  <div class="g-ex g-ex--tile">
    <span class="g-variant">work inside the delay: the card never shows</span>
    <Tool label="Run 0.1 s" @click="run(100, false)" />
  </div>

  <!-- Not a modal: Tab still reaches the page behind it, and an app that must block its page makes
       its own content inert. The mark takes one decorative figure, here the kit's own Spinner. -->
  <Overlay
    :open="open"
    :progress="progress"
    label="Reading"
    subject="survey.csv"
    :detail="progress === null ? 'Checking every row' : `${Math.round(progress * 100)}% of the rows checked`"
    stoppable
    @stop="stop"
  >
    <template #mark><Spinner :size="28" /></template>
  </Overlay>

  <code class="g-ex-state">open = {{ open }}, progress = {{ progress === null ? 'null (the bar sweeps)' : progress.toFixed(2) }}</code>
</template>
