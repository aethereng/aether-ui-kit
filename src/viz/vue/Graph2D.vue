<script setup lang="ts">
/* Thin Vue wrapper over viz/core. Two modes:
 *  - running (default, e.g. gallery): owns the force sim, steps it each frame.
 *  - controlled (running=false): the caller owns nodes[].pos
 *    (store-backed positions, pinning, layout modes); Graph2D only renders and
 *    emits interaction. Same core, same projection — only who drives pos differs.
 * A future GraphGL.vue reuses the same core and only swaps the draw call. */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ForceLayout,
  ortho2d,
  iso3d,
  fitToViewport,
  type GNode,
  type GEdge,
  type Projection,
} from '../core'

const props = withDefaults(
  defineProps<{
    nodes: GNode[]
    edges: GEdge[]
    width?: number
    height?: number
    projection?: 'ortho2d' | 'iso3d'
    running?: boolean
    selection?: string | null
    neighbors?: Set<string> | null
    /** How positions map to the viewport.
     *  'fit'   — rescale the cloud to fill the box every render. Convenient, but the scale
     *            changes as the data moves, so a dragged node does not track the cursor.
     *  'direct'— positions ARE viewport coordinates, drawn 1:1. What the reference does; pair
     *            it with the layout's `bounds` so nothing can leave the stage. */
    mapping?: 'fit' | 'direct'
  }>(),
  {
    width: 720,
    height: 460,
    projection: 'ortho2d',
    running: true,
    selection: null,
    neighbors: null,
    mapping: 'fit',
  },
)

const emit = defineEmits<{
  nodeClick: [id: string]
  nodeDown: [id: string, x: number, y: number]
  drag: [id: string, x: number, y: number]
  dragEnd: [id: string]
}>()

const W = props.width
const H = props.height
const strategy: Projection = props.projection === 'iso3d' ? iso3d : ortho2d
const dims = Math.max(2, ...props.nodes.map((n) => n.pos.length))

// In running mode we copy positions into an internal ForceLayout that we step.
// In controlled mode (running=false) we read props.nodes[].pos directly each render.
const layout = new ForceLayout(
  props.nodes.map((n) => ({ ...n, pos: [...n.pos] })),
  props.edges,
  { dims },
)

const live = computed(() => (props.running ? layout.nodes : props.nodes))

// project + fit world bounds into the viewport
const screen = computed(() => {
  void tick.value // recompute after each force step (running mode)
  const projected = live.value.map((n) => strategy.project(n.pos, dims))
  // 'direct' draws 1:1; 'fit' shares its transform with viz/core so a caller can invert it
  // (see unproject) instead of guessing
  const { minX, minY, s, pad } =
    props.mapping === 'direct'
      ? { minX: 0, minY: 0, s: 1, pad: 0 }
      : fitToViewport(projected, W, H)
  return live.value.map((n, i) => {
    const p = projected[i]!
    const dim = props.neighbors ? !props.neighbors.has(n.id) : false
    return {
      id: n.id,
      label: n.label,
      color: n.color,
      r: n.r ?? 6,
      dim,
      cx: pad + (p.x - minX) * s,
      cy: pad + (p.y - minY) * s,
    }
  })
})

const posById = computed(() => new Map(screen.value.map((s) => [s.id, s])))
function edgeLit(e: GEdge): boolean {
  return !!props.selection && (e.a === props.selection || e.b === props.selection)
}

const raf = ref<number | null>(null)
const ticking = ref(props.running)
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

// ---- drag (controlled mode) ----
const svgRef = ref<SVGSVGElement | null>(null)
let dragId: string | null = null
let moved = false
function toView(e: PointerEvent): { x: number; y: number } {
  const r = svgRef.value?.getBoundingClientRect()
  if (!r) return { x: 0, y: 0 }
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
}
function onNodeDown(e: PointerEvent, id: string) {
  const t = e.target as Element
  const tid = t?.getAttribute?.('data-id') || id
  dragId = tid
  moved = false
  const v = toView(e)
  emit('nodeDown', tid, v.x, v.y)
  window.addEventListener('pointermove', onNodeMove)
  window.addEventListener('pointerup', onNodeUp)
  e.preventDefault()
}
function onNodeMove(e: PointerEvent) {
  if (!dragId) return
  moved = true
  const v = toView(e)
  emit('drag', dragId, v.x, v.y)
}
function onNodeUp() {
  if (!dragId) return
  const id = dragId
  dragId = null
  window.removeEventListener('pointermove', onNodeMove)
  window.removeEventListener('pointerup', onNodeUp)
  if (!moved) emit('nodeClick', id)
  emit('dragEnd', id)
}
</script>

<template>
  <svg ref="svgRef" :viewBox="`0 0 ${W} ${H}`" class="aether-graph" :width="W" :height="H">
    <line
      v-for="(e, i) in edges"
      :key="'e' + i"
      :x1="posById.get(e.a)?.cx ?? 0"
      :y1="posById.get(e.a)?.cy ?? 0"
      :x2="posById.get(e.b)?.cx ?? 0"
      :y2="posById.get(e.b)?.cy ?? 0"
      class="aether-graph__edge"
      :class="{ lit: edgeLit(e) }"
    />
    <g
      v-for="n in screen"
      :key="n.id"
      class="aether-graph__node"
      :class="{ dim: n.dim, sel: n.id === selection }"
      :transform="`translate(${n.cx},${n.cy})`"
      :data-id="n.id"
      @pointerdown="onNodeDown($event, n.id)"
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
  touch-action: none;
}
.aether-graph__edge {
  stroke: var(--aether-line-strong);
  stroke-width: 1;
}
.aether-graph__edge.lit {
  stroke: var(--aether-cool-soft);
  stroke-width: 1.7;
}
.aether-graph__node {
  cursor: pointer;
}
.aether-graph__node.dim {
  opacity: 0.12;
}
.aether-graph__node.sel circle {
  stroke: var(--aether-cool);
  stroke-width: 3;
}
.aether-graph__label {
  fill: var(--aether-ink-soft);
  font:
    600 10px ui-monospace,
    monospace;
  text-anchor: middle;
}
.aether-graph__label.dim {
  opacity: 0.12;
}
</style>
