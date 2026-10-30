<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE: rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import Gallery from '@aether/ui-kit/controls/gallery'
import type { GalleryFamily, GalleryItem } from '@aether/ui-kit/controls/core'
import { mdiCheckCircleOutline, mdiPlus } from '@mdi/js'

/* An app gives `picture` as a file's address, the one for the theme in force. These are drawn here
   only so the example carries no files. */
const drawn = (from: string, to: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/></svg>`,
  )

const families: GalleryFamily[] = [
  { id: 'start', title: 'Start' },
  { id: 'maps', title: 'Maps', line: 'Each opens with its data loaded.' },
  { id: 'charts', title: 'Charts' },
]

const items: GalleryItem[] = [
  { id: 'blank', family: 'start', title: 'Blank map', line: 'An empty sheet to draw on.', icon: mdiPlus },
  {
    id: 'coast',
    family: 'maps',
    title: 'Coastline',
    line: 'Elevation along 40 km of shore.',
    picture: drawn('#2f6f6b', '#e5dfd2'),
    foot: '1,284 samples',
  },
  {
    id: 'valley',
    family: 'maps',
    title: 'River valley',
    line: 'Rainfall by month.',
    picture: drawn('#5fa4a0', '#a9591b'),
    foot: 'Checked against a survey',
    footIcon: mdiCheckCircleOutline,
  },
  {
    id: 'seasons',
    family: 'charts',
    title: 'Seasons',
    line: 'Four years of readings, side by side.',
    picture: drawn('#a9591b', '#a33b52'),
    note: { label: 'Credit', text: 'Readings from a public archive, which a reader can select and copy.' },
  },
]

const opened = ref<string | null>(null)
</script>

<template>
  <div class="g-fill">
    <!-- The page around it stays the app's: its head, how it scrolls and what closes it. -->
    <Gallery :families="families" :items="items" @open="opened = $event" />
    <code class="g-ex-state g-gal-state">opened = {{ opened ?? 'nothing yet' }}</code>
  </div>
</template>

<style scoped>
.g-gal-state {
  display: block;
  margin-top: 14px;
}
</style>
