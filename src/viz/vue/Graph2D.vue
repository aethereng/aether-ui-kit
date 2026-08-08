<script setup lang="ts">
/* Thin Vue wrapper over viz/core. Owns only SVG rendering + the rAF loop that
 * steps the force layout; all geometry (projection, layout) lives in core. A
 * future GraphGL.vue reuses the same core and only changes the draw call. */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ForceLayout, ortho2d, iso3d, type GNode, type GEdge, type Projection } from '../core'

const props = defineProps<{
  nodes: GNode[]
  edges: GEdge[]
  width?: number
  height?: number
  projection?: 'ortho2d' | 'iso3d'
  running?: boolean
}>()

const emit = defineEmits<{ nodeClick: [id: string] }>()

const W = props.width ?? 720
const H = props.height ?? 460
const strategy: Projection = props.projection === 'iso3d' ? iso3d : ortho2d
const dims = Math.max(2, ...props.nodes.map((n) => n.pos.length))

const layout = new ForceLayout(
  props.nodes.map((n) => ({ ...n, pos: [...n.pos] })),
  props.edges,
  { dims },
)

// project + fit world bounds into the viewport
const screen = computed(() => {
  void tick.value // recompute after each force step
  const projected = layout.nodes.map((n) => strategy.project(n.pos, dims))
  const minX = Math.min(...projected.map((p) => p.x))
  const maxX = Math.max(...projected.map((p) => p.x))
  const minY = Math.min(...projected.map((p) => p.y))
  const maxY = Math.max(...projected.map((p) => p.y))
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1
  const pad = 40
  const sx = (W - 2 * pad) / spanX
  const sy = (H - 2 * pad) / spanY
  const s = Math.min(sx, sy)
  return layout.nodes.map((n, i) => {
    const p = projected[i]!
    return {
      id: n.id,
      label: n.label,
      color: n.color,
      r: n.r ?? 6,
      cx: pad + (p.x - minX) * s,
      cy: pad + (p.y - minY) * s,
    }
  })
})

const posById = computed(() => new Map(screen.value.map((s) => [s.id, s])))
const raf = ref<number | null>(null)
const ticking = ref(props.running ?? true)
const tick = ref(0) // reactive bump so `screen` recomputes after each force step

function loop() {
  if (!ticking.value) return
  layout.step()
  tick.value++
  raf.value = requestAnimationFrame(loop)
}

onMounted(() => {
  if (ticking.value) raf.value = requestAnimationFrame(loop)
})
onBeforeUnmount(() => {
  if (raf.value) cancelAnimationFrame(raf.value)
})

watch(ticking, (on) => {
  if (on && !raf.value) raf.value = requestAnimationFrame(loop)
  if (!on && raf.value) {
    cancelAnimationFrame(raf.value)
    raf.value = null
  }
})
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="aether-graph" :width="W" :height="H">
    <line
      v-for="(e, i) in edges"
      :key="'e' + i"
      :x1="posById.get(e.a)?.cx ?? 0"
      :y1="posById.get(e.a)?.cy ?? 0"
      :x2="posById.get(e.b)?.cx ?? 0"
      :y2="posById.get(e.b)?.cy ?? 0"
      class="aether-graph__edge"
    />
    <g
      v-for="n in screen"
      :key="n.id"
      class="aether-graph__node"
      :transform="`translate(${n.cx},${n.cy})`"
      @click="emit('nodeClick', n.id)"
    >
      <circle :r="n.r" :fill="n.color ?? 'var(--aether-cool)'" />
      <text v-if="n.label" :dy="n.r + 11" class="aether-graph__label">{{ n.label }}</text>
    </g>
  </svg>
</template>

<style scoped>
.aether-graph {
  display: block;
  background: var(--aether-surface);
  border: 1px solid var(--aether-line-strong);
  border-radius: 10px;
}
.aether-graph__edge {
  stroke: var(--aether-line-strong);
  stroke-width: 1;
}
.aether-graph__node {
  cursor: pointer;
}
.aether-graph__label {
  fill: var(--aether-ink-soft);
  font:
    600 10px ui-monospace,
    monospace;
  text-anchor: middle;
}
</style>
