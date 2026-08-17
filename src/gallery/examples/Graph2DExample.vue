<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs.
 *
 * Deliberately run CONTROLLED (:running="false"), the way a host that owns its own node positions
 * does: the caller owns nodes[].pos and drives the force sim with the exported ForceLayout. That
 * is the kit's thesis made visible — the layout core is framework-free and usable without the
 * component, and the component only renders and emits. It is also the only mode in which dragging
 * a node can work, because in running mode the component's internal layout owns the positions and
 * a caller's write is ignored. */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Graph2D from '@aether/ui-kit/viz/graph'
import { ForceLayout } from '@aether/ui-kit/viz/core'
import type { GNode, GEdge } from '@aether/ui-kit/viz/core'

/* Five hues rather than three, and every one a token so the graph re-themes with the page. Two of
   the three before were both cool, so a cloud of 18 nodes read as two colours and the categories
   they stand for were not tellable apart at a glance. */
const palette = [
  'var(--aether-cool)',
  'var(--aether-warm)',
  'var(--aether-rose)',
  'var(--aether-ok)',
  'var(--aether-cool-soft)',
]
const W = 560
const H = 360

/* Positions are VIEWPORT coordinates and the sim is clamped to the stage, so with mapping="direct"
   the graph draws 1:1 — nothing wanders off the canvas and a dragged node sits exactly under the
   cursor. The default mapping="fit" refits the cloud every frame, which made the scale drift as
   nodes moved and a drag track at about a third of the pointer. */
const BOUNDS: [number, number, number, number] = [30, 24, W - 30, H - 20]

const nodes = ref<GNode[]>(
  Array.from({ length: 18 }, (_, i) => ({
    id: 'n' + i,
    pos: [W / 2 + (Math.random() - 0.5) * 220, H / 2 + (Math.random() - 0.5) * 180, 0],
    label: i % 5 === 0 ? 'hub' + i : undefined,
    color: palette[i % palette.length],
    r: i % 5 === 0 ? 10 : 5,
  })),
)

const edges: GEdge[] = []
for (let i = 1; i < nodes.value.length; i++) {
  const target = i % 5 === 0 ? i : Math.floor(i / 5) * 5
  edges.push({ a: 'n' + target, b: 'n' + i, w: 1 })
}

/* The sim owns its own node copies and we publish a fresh array each frame; REPLACING the objects
   rather than mutating pos in place is what actually makes Vue re-render. */
const layout = new ForceLayout(
  nodes.value.map((n) => ({ ...n, pos: [...n.pos] })),
  edges,
  { dims: 3, bounds: BOUNDS },
)
const publish = () => {
  nodes.value = layout.nodes.map((n) => ({ ...n, pos: [...n.pos] }))
}

const running = ref(true)
let raf = 0
function loop() {
  layout.step()
  publish()
  // the sim decides when it is done: alpha decays every step, and a drag re-heats it
  if (!layout.running) {
    running.value = false
    return
  }
  raf = requestAnimationFrame(loop)
}
function ensureRunning() {
  if (running.value) return
  running.value = true
  raf = requestAnimationFrame(loop)
}
function rerun() {
  layout.reheat(1)
  ensureRunning()
}

const selected = ref<string | null>(null)
const dragged = ref('—')
const zoom = ref(1)

/* neighbours of the selection, so the `neighbors` emphasis prop has something to do */
const neighbors = computed<Set<string> | null>(() => {
  if (!selected.value) return null
  const s = new Set<string>([selected.value])
  for (const e of edges) {
    if (e.a === selected.value) s.add(e.b)
    if (e.b === selected.value) s.add(e.a)
  }
  return s
})

function onNodeClick(id: string) {
  selected.value = selected.value === id ? null : id
}

function onDrag(id: string, x: number, y: number) {
  layout.pin(id, [x, y])
  dragged.value = id
  ensureRunning()
}
function onDragEnd(id: string) {
  layout.unpin(id)
  layout.reheat(0.3) // let the neighbourhood settle back after release
  ensureRunning()
}

/* Zoom comes from the component's EXPOSED methods rather than a prop, because the host owns the
   chrome: the kit ships the behaviour, you ship the buttons. */
type GraphApi = { zoomIn: () => void; zoomOut: () => void; zoomFit: (pad?: number) => void }
const graph = ref<GraphApi | null>(null)

/* The hover card is the host's, not the kit's — Graph2D emits which node and where the pointer is,
   and only the host knows what a node means. */
const hover = ref<{ id: string; x: number; y: number } | null>(null)
const hoverNode = computed(() => nodes.value.find((n) => n.id === hover.value?.id) ?? null)
const hoverDegree = computed(() =>
  hover.value ? edges.filter((e) => e.a === hover.value!.id || e.b === hover.value!.id).length : 0,
)
function onNodeHover(id: string, x: number, y: number) {
  hover.value = { id, x, y }
}

onMounted(() => {
  raf = requestAnimationFrame(loop)
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <p class="g-hint">
    Drag a node — its neighbours follow. Click one to light its neighbourhood. Wheel or pinch to
    zoom, drag the background to pan; hover a node for the card.
    <button class="g-mini" type="button" @click="rerun()">Re-run layout</button>
    <button class="g-mini" type="button" @click="graph?.zoomOut()">−</button>
    <button class="g-mini" type="button" @click="graph?.zoomIn()">+</button>
    <button class="g-mini" type="button" @click="graph?.zoomFit()">Fit</button>
  </p>

  <Graph2D
    :ref="(el) => (graph = el as unknown as GraphApi | null)"
    :nodes="nodes"
    :edges="edges"
    :width="W"
    :height="H"
    mapping="direct"
    :running="false"
    :selection="selected"
    :neighbors="neighbors"
    zoomable
    @node-click="onNodeClick"
    @drag="onDrag"
    @drag-end="onDragEnd"
    @zoom="zoom = $event"
    @node-hover="onNodeHover"
    @node-leave="hover = null"
  />

  <div
    v-if="hover && hoverNode"
    class="g-hovcard"
    :style="{ left: hover.x + 'px', top: hover.y + 'px' }"
  >
    <b>{{ hoverNode.label || hoverNode.id }}</b>
    <span>{{ hoverDegree }} edge{{ hoverDegree === 1 ? '' : 's' }} · r {{ hoverNode.r }}</span>
  </div>

  <code class="g-ex-state">
    selected = {{ selected || '∅' }} · last drag = {{ dragged }} · layout =
    {{ running ? 'running' : 'settled' }} · nodes = {{ nodes.length }} · zoom =
    {{ Math.round(zoom * 100) }}%
  </code>
</template>
