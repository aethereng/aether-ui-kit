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
    /** Wheel/pinch to zoom, background-drag to pan. Off by default: a graph that eats the
     *  wheel is hostile inside a scrolling page, so the host opts in. */
    zoomable?: boolean
    minZoom?: number
    maxZoom?: number
  }>(),
  {
    width: 720,
    height: 460,
    projection: 'ortho2d',
    running: true,
    selection: null,
    neighbors: null,
    mapping: 'fit',
    zoomable: false,
    minZoom: 0.25,
    maxZoom: 6,
  },
)

const emit = defineEmits<{
  nodeClick: [id: string]
  nodeDown: [id: string, x: number, y: number]
  drag: [id: string, x: number, y: number]
  dragEnd: [id: string]
  /** Current scale, after every zoom. Hosts that show a percentage read this. */
  zoom: [k: number]
  /** Pointer is over a node — fired on entry and on every move while it stays there, so a
   *  host card can track the cursor. The kit does not own tooltip content: only the host
   *  knows what a node means. Paired with nodeLeave. */
  nodeHover: [id: string, clientX: number, clientY: number]
  nodeLeave: []
}>()

/* Reactive, not snapshotted. These were read once at setup, so a stage that resized -- or a
 * host that measured its container after mount, which is the normal case -- kept the viewBox
 * it happened to have at first render and the graph never filled its space. */
const W = computed(() => props.width)
const H = computed(() => props.height)
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
      : fitToViewport(projected, W.value, H.value)
  return live.value.map((n, i) => {
    const p = projected[i]!
    const dim = props.neighbors ? !props.neighbors.has(n.id) : false
    return {
      id: n.id,
      label: n.label,
      color: n.color,
      r: n.r ?? 6,
      opacity: n.opacity,
      stroke: n.stroke,
      strokeWidth: n.strokeWidth,
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
  svgRef.value?.addEventListener('wheel', onWheel, { passive: false })
})
onBeforeUnmount(() => {
  if (raf.value) cancelAnimationFrame(raf.value)
  if (edgePanRaf !== null) cancelAnimationFrame(edgePanRaf)
  svgRef.value?.removeEventListener('wheel', onWheel)
  window.removeEventListener('pointermove', onNodeMove)
  window.removeEventListener('pointerup', onNodeUp)
  window.removeEventListener('pointermove', onSurfaceMove)
  window.removeEventListener('pointerup', onSurfaceUp)
  window.removeEventListener('pointercancel', onSurfaceUp)
})
watch(ticking, (on) => {
  if (on && !raf.value) raf.value = requestAnimationFrame(loop)
  if (!on && raf.value) {
    cancelAnimationFrame(raf.value)
    raf.value = null
  }
})

/* ---- zoom + pan ----------------------------------------------------------
 * The layout keeps running in world coordinates; one <g> carries the view transform, and
 * pointer maths converts back through it, so a dragged node still lands under the cursor at
 * any scale. Labels divide the scale back out so they stay legible instead of ballooning. */
const zk = ref(1)
const zx = ref(0)
const zy = ref(0)
const viewTransform = computed(
  () => `translate(${zx.value.toFixed(2)},${zy.value.toFixed(2)}) scale(${zk.value.toFixed(4)})`,
)

/* Content bounds in world space, used to keep a pan from losing the graph off-screen. */
function contentBox() {
  const s = screen.value
  if (!s.length) return { x0: 0, y0: 0, x1: W.value, y1: H.value }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const n of s) {
    x0 = Math.min(x0, n.cx - n.r); y0 = Math.min(y0, n.cy - n.r)
    x1 = Math.max(x1, n.cx + n.r); y1 = Math.max(y1, n.cy + n.r)
  }
  return { x0, y0, x1, y1 }
}
/* Pan is clamped, unlike the reference, which lets you drag the graph clean off the canvas
 * with no way back but Fit. At least KEEP_VISIBLE px of content stays inside the box. */
const KEEP_VISIBLE = 60
function clampPan() {
  const b = contentBox()
  const left = zx.value + b.x0 * zk.value
  const right = zx.value + b.x1 * zk.value
  const top = zy.value + b.y0 * zk.value
  const bottom = zy.value + b.y1 * zk.value
  const visX = Math.min(KEEP_VISIBLE, right - left)
  const visY = Math.min(KEEP_VISIBLE, bottom - top)
  if (right < visX) zx.value += visX - right
  else if (left > W.value - visX) zx.value -= left - (W.value - visX)
  if (bottom < visY) zy.value += visY - bottom
  else if (top > H.value - visY) zy.value -= top - (H.value - visY)
}

function zoomAt(mx: number, my: number, factor: number) {
  const k = Math.min(props.maxZoom, Math.max(props.minZoom, zk.value * factor))
  if (k === zk.value) return
  // world point under the cursor, kept pinned there across the scale change
  const wx = (mx - zx.value) / zk.value
  const wy = (my - zy.value) / zk.value
  zk.value = k
  zx.value = mx - wx * k
  zy.value = my - wy * k
  clampPan()
  emit('zoom', zk.value)
}
function zoomIn() { zoomAt(W.value / 2, H.value / 2, 1.25) }
function zoomOut() { zoomAt(W.value / 2, H.value / 2, 1 / 1.25) }
/* A real fit, not just a reset to identity: the content box is scaled into the viewport. On a
 * layout already clamped to the stage that lands at ~1, which is what the reference's Fit did. */
function zoomFit(pad = 16) {
  const b = contentBox()
  const bw = b.x1 - b.x0
  const bh = b.y1 - b.y0
  if (bw <= 0 || bh <= 0) { zk.value = 1; zx.value = 0; zy.value = 0; emit('zoom', 1); return }
  const k = Math.min(props.maxZoom, Math.max(props.minZoom,
    Math.min((W.value - pad * 2) / bw, (H.value - pad * 2) / bh)))
  zk.value = k
  zx.value = (W.value - (b.x0 + b.x1) * k) / 2
  zy.value = (H.value - (b.y0 + b.y1) * k) / 2
  emit('zoom', k)
}
defineExpose({ zoomIn, zoomOut, zoomFit, zoomAt, zoom: zk })

// ---- drag (controlled mode) ----
const svgRef = ref<SVGSVGElement | null>(null)
let dragId: string | null = null
let moved = false
/* mirrors dragId purely so the cursor can react -- see `dragging` below */
const nodeDragging = ref(false)
/* True for either kind of drag, node or background pan. A node keeps its own `cursor:pointer`
 * rule, which normally wins over an ancestor's cursor because it is a rule on the element
 * itself, not an inherited value -- so panning is not enough by itself to show "grabbing"
 * while the pointer happens to cross a node mid-drag. `.dragging .aether-graph__node` below
 * is written to be MORE specific than `.aether-graph__node` alone so it wins without `!important`. */
const dragging = computed(() => panning.value || nodeDragging.value)
/* Client coords -> viewBox coords. */
function toBox(clientX: number, clientY: number): { x: number; y: number } {
  const r = svgRef.value?.getBoundingClientRect()
  if (!r) return { x: 0, y: 0 }
  return { x: ((clientX - r.left) / r.width) * W.value, y: ((clientY - r.top) / r.height) * H.value }
}
/* ...and on through the view transform, so a drag is in the same space as nodes[].pos. Takes
 * a plain {clientX,clientY} rather than a PointerEvent so the edge-pan loop below can call it
 * with the last-known pointer position on frames where no real event fired. */
function toView(p: { clientX: number; clientY: number }): { x: number; y: number } {
  const b = toBox(p.clientX, p.clientY)
  return { x: (b.x - zx.value) / zk.value, y: (b.y - zy.value) / zk.value }
}

/* ---- edge-pan while dragging a node ---------------------------------------------------
 * A dragged node's world position is never clamped (see the layout core's default bounds:
 * unbounded), but the SVG viewport clips to its own box regardless -- overflow:hidden is the
 * UA default for <svg>. Drag far enough and the node vanishes at the edge, indistinguishable
 * from a hard wall even though the data underneath kept moving. So when the pointer is near
 * an edge during a node drag, nudge the view toward it each frame, the way Figma/Miro/Maps
 * do -- the node stays under the cursor, the canvas scrolls to meet it. Panning the
 * background never had this problem (nothing is clipped by revealing empty canvas), so this
 * is scoped to node drags only, and only when zoomable (no view transform to shift otherwise). */
const EDGE_MARGIN = 36 // px from the SVG's edge where auto-pan kicks in
const EDGE_MAX_SPEED = 10 // px/frame at the very edge
let lastClientX = 0, lastClientY = 0
let edgePanRaf: number | null = null
/* Near the low edge (pos small): reveal content further toward negative-world-X, which means
 * shifting the CONTENT toward positive screen-X (zx grows) so the unseen low side scrolls
 * in. Near the high edge: the opposite, zx shrinks. Getting this backwards doesn't just pan
 * the wrong way -- clampPan sees the main cluster sliding toward the OPPOSITE edge and pulls
 * it back, so the two fight every frame and net to a standstill near zero, not a wrong-but-
 * visible pan. That is exactly what a naive sign flip looks like when you test it: nothing
 * moves, rather than moving backwards. */
function edgePanDelta(pos: number, size: number): number {
  if (pos < EDGE_MARGIN) return EDGE_MAX_SPEED * (1 - pos / EDGE_MARGIN)
  if (pos > size - EDGE_MARGIN) return -EDGE_MAX_SPEED * (1 - (size - pos) / EDGE_MARGIN)
  return 0
}
function edgePanStep() {
  if (!dragId) { edgePanRaf = null; return }
  const r = svgRef.value?.getBoundingClientRect()
  if (r && r.width && r.height) {
    const dx = edgePanDelta(lastClientX - r.left, r.width)
    const dy = edgePanDelta(lastClientY - r.top, r.height)
    if (dx || dy) {
      zx.value += dx; zy.value += dy
      clampPan()
      // the same screen point now maps to a different world point -- keep the drag in sync
      // rather than let the node lag behind while the canvas scrolls under a still cursor
      const v = toView({ clientX: lastClientX, clientY: lastClientY })
      emit('drag', dragId, v.x, v.y)
    }
  }
  edgePanRaf = requestAnimationFrame(edgePanStep)
}

function onNodeDown(e: PointerEvent, id: string) {
  const t = e.target as Element
  const tid = t?.getAttribute?.('data-id') || id
  dragId = tid
  nodeDragging.value = true
  moved = false
  lastClientX = e.clientX; lastClientY = e.clientY
  const v = toView(e)
  emit('nodeDown', tid, v.x, v.y)
  window.addEventListener('pointermove', onNodeMove)
  window.addEventListener('pointerup', onNodeUp)
  if (props.zoomable && edgePanRaf === null) edgePanRaf = requestAnimationFrame(edgePanStep)
  e.preventDefault()
}
function onNodeMove(e: PointerEvent) {
  if (!dragId) return
  moved = true
  lastClientX = e.clientX; lastClientY = e.clientY
  const v = toView(e)
  emit('drag', dragId, v.x, v.y)
}
function onNodeUp() {
  if (!dragId) return
  const id = dragId
  dragId = null
  nodeDragging.value = false
  window.removeEventListener('pointermove', onNodeMove)
  window.removeEventListener('pointerup', onNodeUp)
  if (!moved) emit('nodeClick', id)
  emit('dragEnd', id)
}

// ---- background pan, wheel zoom, pinch ----
let pan: { x: number; y: number; ox: number; oy: number } | null = null
/* mirrored as a ref purely so the cursor can change: a plain `let` is invisible to Vue */
const panning = ref(false)
/* Every pointer currently down on the stage. Two of them is a pinch. */
const pointers = new Map<number, { x: number; y: number }>()
let pinchDist = 0

function onSurfaceDown(e: PointerEvent) {
  if (!props.zoomable) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  /* Release listeners go on for EVERY tracked pointer, before any early return. They used to
   * be attached only when a pan actually started, so a press that landed on a node put its id
   * in the map and nothing ever took it out. Two node drags later the map held two stale
   * pointers, the next gesture took the pinch branch, and the graph zoomed off a distance
   * between two fingers that were no longer down. Re-adding the same handler is a DOM no-op. */
  window.addEventListener('pointermove', onSurfaceMove)
  window.addEventListener('pointerup', onSurfaceUp)
  window.addEventListener('pointercancel', onSurfaceUp)
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y)
    pan = null
    panning.value = false
    return
  }
  // a node drag wins over a pan
  if ((e.target as Element)?.closest?.('[data-id]')) return
  pan = { x: e.clientX, y: e.clientY, ox: zx.value, oy: zy.value }
  panning.value = true
}
function onSurfaceMove(e: PointerEvent) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    const d = Math.hypot(a!.x - b!.x, a!.y - b!.y)
    if (pinchDist > 0 && d > 0) {
      const c = toBox((a!.x + b!.x) / 2, (a!.y + b!.y) / 2)
      zoomAt(c.x, c.y, d / pinchDist)
    }
    pinchDist = d
    return
  }
  if (!pan) return
  // the pointer moves in CSS px; the transform lives in viewBox units
  const r = svgRef.value?.getBoundingClientRect()
  const sx = r && r.width ? W.value / r.width : 1
  const sy = r && r.height ? H.value / r.height : 1
  zx.value = pan.ox + (e.clientX - pan.x) * sx
  zy.value = pan.oy + (e.clientY - pan.y) * sy
  clampPan()
}
function onSurfaceUp(e: PointerEvent) {
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinchDist = 0
  if (pointers.size) return
  pan = null
  panning.value = false
  window.removeEventListener('pointermove', onSurfaceMove)
  window.removeEventListener('pointerup', onSurfaceUp)
  window.removeEventListener('pointercancel', onSurfaceUp)
}
/* Bound by hand, not with @wheel: preventDefault needs a non-passive listener, and the
 * browser makes wheel listeners passive by default in enough places to be a coin-toss. */
function onWheel(e: WheelEvent) {
  if (!props.zoomable) return
  e.preventDefault()
  const b = toBox(e.clientX, e.clientY)
  zoomAt(b.x, b.y, e.deltaY < 0 ? 1.12 : 1 / 1.12)
}

// ---- hover ----
let hoverId: string | null = null
function onSurfaceHover(e: PointerEvent) {
  // a card that follows you around mid-drag is noise, not information
  if (dragId || pan) { onSurfaceLeave(); return }
  const el = (e.target as Element)?.closest?.('[data-id]')
  const id = el?.getAttribute('data-id') || null
  if (!id) {
    if (hoverId) { hoverId = null; emit('nodeLeave') }
    return
  }
  hoverId = id
  emit('nodeHover', id, e.clientX, e.clientY)
}
function onSurfaceLeave() {
  if (hoverId) { hoverId = null; emit('nodeLeave') }
}
</script>

<template>
  <svg
    ref="svgRef"
    :viewBox="`0 0 ${W} ${H}`"
    class="aether-graph"
    :class="{ zoomable, dragging }"
    :width="W"
    :height="H"
    :style="{ '--aether-graph-label-scale': (1 / zk).toFixed(3) }"
    @pointerdown="onSurfaceDown"
    @pointermove="onSurfaceHover"
    @pointerleave="onSurfaceLeave"
  >
    <!-- one group carries the view transform; everything inside stays in world space -->
    <g :transform="viewTransform">
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
        <circle
          :r="n.r"
          :fill="n.color ?? 'var(--aether-cool)'"
          :opacity="n.opacity"
          :stroke="n.stroke"
          :stroke-width="n.strokeWidth"
        />
        <!-- the gap is in SCREEN px, so it divides the scale out the same way the type size
             does; a flat world-space offset walked the label away from its node as you zoomed -->
        <text v-if="n.label" :dy="n.r + 11 / zk" class="aether-graph__label">{{ n.label }}</text>
      </g>
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
/* Three states, consistently: grab over the canvas (it can be panned), pointer over a node
 * (it can be clicked or dragged), grabbing the moment either turns into an actual drag.
 * The last rule is written MORE specific than `.aether-graph__node { cursor: pointer }` above
 * -- two classes beats one -- so it wins outright without `!important`, even while the
 * pointer is directly over a node mid-pan or over a different node mid-node-drag. */
.aether-graph.zoomable {
  cursor: grab;
}
.aether-graph.dragging {
  cursor: grabbing;
}
.aether-graph.dragging .aether-graph__node {
  cursor: grabbing;
}
.aether-graph__label {
  fill: var(--aether-ink-soft);
  /* the scale is divided back out so labels stay legible instead of ballooning with the zoom */
  font-size: calc(10px * var(--aether-graph-label-scale, 1));
  font-family: var(--aether-font-mono, ui-monospace, monospace);
  font-weight: 600;
  text-anchor: middle;
}
.aether-graph__label.dim {
  opacity: 0.12;
}
</style>
