<script setup lang="ts" generic="E extends ChatEntry = ChatMessage">
/* A message log and a compose box. Controlled, like the rest of the kit: the caller owns the message
 * list and the compose string, and owns what Send and Apply reply do. ChatPanel renders and emits; it
 * never writes to either itself.
 *
 * TWO WAYS TO READ THE LOG. By default a message is plain text, drawn as written. `rich` is for a log
 * whose replies carry more: a reply is markdown with its `{{scope:path}}` references drawn as chips, a
 * message may highlight spans, and a message that is still arriving ends in a caret, is followed while
 * the reader stays at the bottom, and is announced once when it settles. Without `rich` none of that
 * renders and none of its props is read, so a plain log renders no element for it;
 * ChatPanel.dom.test.ts pins the plain contract and ChatPanel.rich.dom.test.ts its counterpart.
 *
 * WHAT A CALLER ADDS AROUND IT. A log may hold entries of the caller's own kinds, which the `entry` slot
 * draws where they stand; the history cap and the follow rule count them like any message. The
 * `message-extra` slot adds to a text message, `above-compose` sits between the log and the box, and
 * `actions` replaces the three buttons, with `shortcut` saying what Ctrl/Cmd+Enter asks for. `announce`
 * posts a line to the panel's one live region. ChatPanel.seam.dom.test.ts holds all of them.
 *
 * WHAT THE PANEL NEVER DOES: resolve a reference, decide a numeral is bare, or end a stream. It renders
 * what it is given and emits what was asked. `resolveRef` is called while rendering, once per reference
 * per update, so it should be a lookup. */
import { computed, h, nextTick, ref, watch, type VNodeChild } from 'vue'
import { describeRef, isTextMessage, splitReferences, STREAM_FOLLOW_THRESHOLD, usableMarks } from '../core/chat'
import { markdownBlocks, type MdBlock, type MdInline } from '../core/markdown'
import { DEFAULT_REFERENCE_SCOPES, type ReferenceScopes } from '../core/refs'
import type { ChatEntry, ChatMessage, ChatSegment, RefChipData } from '../core/chat'
import ChatRefChip from './ChatRefChip.vue'
import Tool from './Tool.vue'

const props = withDefaults(
  defineProps<{
    /** The log: text messages, and entries of the caller's own kinds for the `entry` slot. */
    messages: E[]
    modelValue: string
    placeholder?: string
    queueLabel?: string
    sendLabel?: string
    applyLabel?: string
    /** The word printed over a reply. */
    replyLabel?: string
    /** How many recent messages to render. The log is append-only and never trimmed by the
     *  caller, so some cap matters for a conversation that runs long; both real consumers
     *  cap it differently (50 vs 60), hence a prop rather than a constant. */
    historyLimit?: number
    /** What Ctrl/Cmd+Enter asks for. */
    shortcut?: 'queue' | 'send'
    /** Read a reply as markdown with reference chips, draw marks, and follow and announce a message
     *  that is still arriving. Off, every message is plain text and the two props below are not read. */
    rich?: boolean
    /** The app's answer for a reference (`scope:path`): what to show in the chip, or null when it
     *  cannot resolve it. Absent means every reference is the warning chip. */
    resolveRef?: (ref: string) => RefChipData | null
    /** The reference scopes drawn as chips: what a `{{scope:path}}` may name. A scope outside this list
     *  is plain text. */
    refScopes?: ReferenceScopes
  }>(),
  {
    placeholder: 'Message…',
    queueLabel: 'Queue',
    sendLabel: 'Send',
    applyLabel: 'Apply reply',
    replyLabel: 'reply',
    historyLimit: 50,
    shortcut: 'queue',
    rich: false,
    resolveRef: undefined,
    refScopes: () => DEFAULT_REFERENCE_SCOPES,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  queue: []
  send: []
  'open-ref': [ref: string]
  'apply-reply': []
}>()

defineSlots<{
  /** The caller's copy for an empty log. */
  empty?: () => unknown
  /** One entry of the caller's own kind, drawn where it stands in the log. */
  entry?: (props: { entry: Exclude<E, ChatMessage> }) => unknown
  /** Extra content inside each text message. */
  'message-extra'?: (props: { message: Extract<E, ChatMessage> }) => unknown
  /** Between the log and the compose box. */
  'above-compose'?: () => unknown
  /** In place of the three buttons and the queued count. */
  actions?: () => unknown
}>()

const pending = computed(
  () => props.messages.filter((m) => isTextMessage(m) && m.role === 'you' && m.queued).length,
)
const visible = computed(() => props.messages.slice(-props.historyLimit))

function roleLabel(role: ChatMessage['role']) {
  return role === 'you' ? 'you' : role === 'reply' ? props.replyLabel : 'note'
}

function refsLabel(refs: string[]) {
  return (refs.length > 1 ? 'refs' : 'ref') + ': ' + refs.join(' · ')
}

/* ---- what a text message is made of, in a rich log ---- */

type Part =
  | { type: 'text'; text: string }
  | { type: 'mark'; text: string; kind: string }
  | { type: 'ref'; ref: string }

/* References are read in replies only. A person's own words, or a system note, that happen to
   contain braces stay exactly as written. */
function segmentsOf(m: ChatMessage): ChatSegment[] {
  if (m.role === 'reply') return splitReferences(m.text, props.refScopes)
  return m.text ? [{ kind: 'text', text: m.text, start: 0, end: m.text.length }] : []
}

function partsOf(m: ChatMessage): Part[] {
  const marks = usableMarks(m.text, m.marks)
  const parts: Part[] = []
  for (const seg of segmentsOf(m)) {
    if (seg.kind === 'ref') {
      parts.push({ type: 'ref', ref: seg.ref })
      continue
    }
    let at = seg.start
    for (const k of marks) {
      const start = Math.max(k.start, seg.start)
      const end = Math.min(k.end, seg.end)
      if (start >= end) continue
      if (start > at) parts.push({ type: 'text', text: m.text.slice(at, start) })
      parts.push({ type: 'mark', text: m.text.slice(start, end), kind: k.kind })
      at = end
    }
    if (at < seg.end) parts.push({ type: 'text', text: m.text.slice(at, seg.end) })
  }
  return parts
}

const resolve = (ref: string): RefChipData | null => props.resolveRef?.(ref) ?? null

/* A reply is read as markdown (see core/markdown.ts). These draw its pieces: text as text, a mark as
   the panel draws every mark, a reference as its chip, a line break as a break, and a formatted span
   as its element around its children. Every string reaches the page as a text node. */
function inlineVNodes(nodes: readonly MdInline[]): VNodeChild[] {
  return nodes.flatMap((n): VNodeChild[] => {
    if (n.kind === 'text') {
      return n.mark === null
        ? [n.text]
        : [h('mark', { class: 'aether-chat__mark', title: n.mark }, [h('span', { class: 'aether-chat__sr' }, n.mark + ': '), n.text])]
    }
    if (n.kind === 'ref') {
      return [h(ChatRefChip, { reference: n.ref, data: resolve(n.ref), onOpen: (r: string) => emit('open-ref', r) })]
    }
    if (n.kind === 'br') return [h('br')]
    return [h(n.kind, inlineVNodes(n.children))]
  })
}
/* The blocks as draw calls. A heading is a paragraph in bold at the reply's own size; a quote is a
   blockquote around its own blocks; a code block is preformatted, so its spaces and breaks stay, and
   its text is a tab stop, as the panel's other scroll boxes are. */
function blockVNodes(blocks: readonly MdBlock[]): VNodeChild[] {
  return blocks.map((b): VNodeChild => {
    if (b.kind === 'p') return h('p', null, inlineVNodes(b.children))
    if (b.kind === 'heading') return h('p', { class: 'aether-chat__md-heading' }, [h('strong', null, inlineVNodes(b.children))])
    if (b.kind === 'list') {
      return h(b.ordered ? 'ol' : 'ul', b.ordered ? { start: b.start } : null, b.items.map((item) => h('li', null, inlineVNodes(item))))
    }
    if (b.kind === 'quote') return h('blockquote', { class: 'aether-chat__md-quote' }, blockVNodes(b.blocks))
    return h(
      'pre',
      { class: 'aether-chat__md-code', role: 'group', tabindex: '0', 'aria-label': 'Code' },
      [h('code', null, inlineVNodes(b.children))],
    )
  })
}
const MdBlocks = (p: { blocks: readonly MdBlock[] }) => blockVNodes(p.blocks)
function blocksOf(m: ChatMessage): MdBlock[] {
  return markdownBlocks(m.text, m.marks, props.refScopes)
}
/* The words a screen reader is given for a reply: the same text the markdown draws, with each
   reference as its chip's accessible name and a line break as a newline. */
function spokenInline(nodes: readonly MdInline[]): string {
  return nodes
    .map((n) =>
      n.kind === 'text' ? n.text : n.kind === 'ref' ? describeRef(n.ref, resolve(n.ref)).name : n.kind === 'br' ? '\n' : spokenInline(n.children),
    )
    .join('')
}
function spokenBlocks(blocks: readonly MdBlock[]): string {
  return blocks
    .map((b) =>
      b.kind === 'list' ? b.items.map(spokenInline).join('\n') : b.kind === 'quote' ? spokenBlocks(b.blocks) : spokenInline(b.children),
    )
    .join('\n\n')
}

/* ---- the log: following it, and announcing a message once ---- */

const logEl = ref<HTMLElement | null>(null)
function scrollToBottom() {
  return nextTick(() => {
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  })
}

// auto-scroll on every new message, so the caller never has to reach into the DOM for this; in a
// rich log the snapshot watcher below decides
watch(
  () => props.messages.length,
  () => {
    if (!props.rich) scrollToBottom()
  },
)

/* What the screen reader is told when a streaming message settles: the settled text, with each
   reference read as its chip's accessible name. One persistent live region, posted to once per
   settled message. It exists from the first render, empty: a live region that is inserted already
   holding its text is the case assistive technology most often misses.
   Each post is a NEW child of the region (the key changes), not new text in the old one. A message
   that settles with exactly the words of the one before it changes no text, and a region whose text
   did not change announces nothing; an added node is announced every time. */
const announcement = ref('')
const posts = ref(0)

function announce(text: string) {
  announcement.value = text
  posts.value++
}

function spoken(m: ChatMessage): string {
  return m.role === 'reply'
    ? spokenBlocks(blocksOf(m))
    : segmentsOf(m)
        .map((s) => (s.kind === 'ref' ? describeRef(s.ref, resolve(s.ref)).name : s.text))
        .join('')
}

/* One watcher serves every scroll rule of a rich log. It runs BEFORE the render that changes the log,
   which is the only moment "was the reader at the bottom" can be measured: afterwards the new text
   has already pushed the edge away and every reader looks scrolled up.
   A message is followed while it streams, and for the update that settles it, so a last piece of text that
   arrives together with the end of the stream is not lost. Growth of a message that is not
   streaming is not followed.
   A change of messages.length scrolls from anywhere when nothing is streaming, and when the new
   entry is the reader's own message. While an entry streams, any other entry appended to the log
   goes through the same at-bottom test as the stream, so a reader who scrolled up is not pulled
   down. */
type Snapshot = { streaming: boolean; length: number } | null
/* Empty in a plain log, so a plain host pays nothing for it and its reactive reads are not tracked. */
const snapshot = (): Snapshot[] =>
  props.rich
    ? props.messages.map((m) => (isTextMessage(m) ? { streaming: !!m.streaming, length: m.text.length } : null))
    : []
let last = snapshot()
watch(
  snapshot,
  (now) => {
    const was = last
    last = now
    if (!props.rich) return
    const el = logEl.value
    const atBottom = !!el && el.scrollHeight - el.scrollTop - el.clientHeight <= STREAM_FOLLOW_THRESHOLD
    let grew = false
    now.forEach((n, i) => {
      const w = was[i]
      if (!n || !w) return
      if ((n.streaming || w.streaming) && n.length > w.length) grew = true
      const m = props.messages[i]
      if (w.streaming && !n.streaming && m && isTextMessage(m)) announce(spoken(m))
    })
    const lengthChanged = now.length !== was.length
    const streamed = was.some((w) => w?.streaming) || now.some((n) => n?.streaming)
    const own = lengthChanged && props.messages.slice(was.length).some((m) => isTextMessage(m) && m.role === 'you')
    if ((lengthChanged && (own || !streamed)) || ((grew || lengthChanged) && atBottom)) scrollToBottom()
  },
  { flush: 'pre' },
)

const textareaEl = ref<HTMLTextAreaElement | null>(null)
/* A host with an "ask about this" shortcut needs to both prefill the compose box (via
 * v-model, from outside) and focus it in one call: the same need SearchField's expose
 * solves for its input. `announce` reaches the live region, which a rich log alone draws. */
defineExpose({ focus: () => textareaEl.value?.focus(), announce })
</script>

<template>
  <div class="aether-chat">
    <div ref="logEl" class="aether-chat__log" :class="{ 'aether-chat__log--rich': rich }">
      <div v-if="!messages.length && $slots.empty" class="aether-chat__msg aether-chat__msg--sys">
        <span class="aether-chat__who">how this works</span>
        <slot name="empty" />
      </div>
      <template v-for="(m, i) in visible" :key="i">
        <div
          v-if="isTextMessage(m)"
          class="aether-chat__msg"
          :class="[`aether-chat__msg--${m.role}`, { queued: m.queued }]"
          :aria-busy="rich && m.streaming ? 'true' : undefined"
        >
          <span class="aether-chat__who">{{ roleLabel(m.role) }}{{ m.queued ? ' · queued' : '' }}</span>
          <div v-if="rich && m.role === 'reply'" class="aether-chat__txt aether-chat__md">
            <MdBlocks :blocks="blocksOf(m)" />
            <span v-if="m.streaming" class="aether-chat__caret" aria-hidden="true"></span>
          </div>
          <span v-else class="aether-chat__txt"
            ><template v-if="!rich">{{ m.text }}</template
            ><template v-else
              ><template v-for="(p, k) in partsOf(m)" :key="k"
                ><ChatRefChip
                  v-if="p.type === 'ref'"
                  :reference="p.ref"
                  :data="resolve(p.ref)"
                  @open="emit('open-ref', $event)" /><mark
                  v-else-if="p.type === 'mark'"
                  class="aether-chat__mark"
                  :title="p.kind"
                  ><span class="aether-chat__sr">{{ p.kind }}: </span>{{ p.text }}</mark
                ><template v-else>{{ p.text }}</template></template
              ><span v-if="m.streaming" class="aether-chat__caret" aria-hidden="true"></span
            ></template>
          </span>
          <div v-if="m.refs?.length" class="aether-chat__ref">{{ refsLabel(m.refs) }}</div>
          <slot name="message-extra" :message="m as Extract<E, ChatMessage>" />
        </div>

        <slot v-else name="entry" :entry="m as Exclude<E, ChatMessage>" />
      </template>
      <!-- A rich log's, and present from the first render: see `announcement`. -->
      <div v-if="rich" class="aether-chat__sr" role="status"><span :key="posts">{{ announcement }}</span></div>
    </div>
    <slot name="above-compose" />
    <div class="aether-chat__compose">
      <textarea
        ref="textareaEl"
        :value="modelValue"
        :placeholder="placeholder"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @keydown.enter.ctrl.prevent="emit(shortcut as 'queue')"
        @keydown.enter.meta.prevent="emit(shortcut as 'queue')"
      ></textarea>
      <div class="aether-chat__actions">
        <slot name="actions">
          <Tool :label="queueLabel" hot @click="emit('queue')" />
          <Tool :label="sendLabel" @click="emit('send')" />
          <Tool :label="applyLabel" @click="emit('apply-reply')" />
          <span class="aether-chat__hint">{{ pending ? pending + ' queued' : 'nothing queued' }}</span>
        </slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The plain log's rules live in ui-kit.css, and so do a mark and the hidden text beside it, which a
   caller's own entries draw too. Everything here belongs to the rich log and is scoped to this
   component. */

/* The live region is out of flow, so it adds neither a flex gap nor scroll extent, and the log is
   its containing block so it cannot position against some distant ancestor. */
.aether-chat__log--rich {
  position: relative;
}

/* ---- text ---- */
/* A reply's markdown. Its line breaks are elements, and no text node holds one, so pre-wrap keeps
   the spacing of a plain line (runs of blanks, leading indentation) as the message's own rule does. */
.aether-chat__md {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.aether-chat__md p,
.aether-chat__md ul,
.aether-chat__md ol {
  margin: 0 0 6px;
}
.aether-chat__md ul,
.aether-chat__md ol {
  padding-left: 1.4em;
}
.aether-chat__md code {
  padding: 0 3px;
  border-radius: 3px;
  background: var(--aether-panel);
  font-family: var(--aether-font-mono);
  font-size: 0.92em;
}
/* A block quote is indented and ruled. Its last block holds no space below it. */
.aether-chat__md-quote {
  margin: 0 0 6px;
  padding: 2px 0 2px 10px;
  border-left: 3px solid var(--aether-line-strong);
  color: var(--aether-ink-soft);
}
.aether-chat__md-quote > :last-child {
  margin-bottom: 0;
}
/* A code block keeps its spaces and its line breaks, and scrolls inside its own box. The inline code
   rule above is for spans, so this rule resets the code element inside the block. */
.aether-chat__md-code {
  margin: 0 0 6px;
  padding: 8px 10px;
  overflow: auto;
  border: 1px solid var(--aether-line);
  border-radius: var(--aether-radius);
  background: var(--aether-panel);
  font-family: var(--aether-font-mono);
  font-size: 11.5px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.aether-chat__md-code code {
  padding: 0;
  border-radius: 0;
  background: none;
  font-size: inherit;
}
.aether-chat__md-code:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 1px;
}
.aether-chat__caret {
  display: inline-block;
  width: 0.5em;
  height: 1em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: currentColor;
  opacity: 0.55;
}
@media (prefers-reduced-motion: no-preference) {
  .aether-chat__caret {
    animation: aether-chat-blink 1s steps(2, start) infinite;
  }
}
@keyframes aether-chat-blink {
  to {
    visibility: hidden;
  }
}
</style>
