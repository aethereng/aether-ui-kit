<script setup lang="ts">
/* A message log + compose box for the "queue instructions, export a request file, apply the
 * reply" pattern used by every surface that talks to an agent. Extracted after two hosts
 * (a file browser, a card board) shipped it identically: same log shape, same three
 * buttons, same Ctrl/Cmd+Enter-to-queue binding, same "queued" dashed state: with only the
 * export/import logic actually differing between them. That is the split this component
 * draws: it owns the log and the compose box; the caller owns what Send and Apply reply DO.
 *
 * Controlled, like the rest of the kit: the caller owns both the message list and the
 * compose string. ChatPanel renders + emits; it never writes to either itself.
 *
 * ONE AXIS. An assistant panel sends one request at a time, can stop it, and fills the log with
 * more than text. It differs from the relay hosts above along exactly one axis, which the README's
 * rule makes a prop: `actions` is 'relay' (Queue, Send, Apply reply; the default) or 'assistant'
 * (Send, and Stop while `busy`). The log, the compose box, the auto-scroll and the history cap are
 * shared by both.
 *
 * EVERYTHING BELOW THE RELAY PATH IS BEHIND 'assistant'. The extra message kinds, reference chips,
 * marks, the fixed line, the live region and the stream-following rule have one consumer, the
 * assistant mode. Under 'relay' none of them renders and none of their props is read, so a relay
 * host's log renders no new element; ChatPanel.dom.test.ts pins the relay contract and
 * ChatPanel.assistant.dom.test.ts its counterpart.
 *
 * WHAT THE PANEL NEVER DOES, under either value: accept a proposal, resolve a reference, decide a
 * numeral is bare, or stop a stream. It renders what it is given and emits what was asked.
 * `resolveRef` is called while rendering, once per reference per update, so it should be a
 * lookup. */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { formatElapsed, quietSeconds } from '../core/activity'
import { describeRef, isTextMessage, splitReferences, STREAM_FOLLOW_THRESHOLD } from '../core/chat'
import { DEFAULT_REFERENCE_SCOPES, type ReferenceScopes } from '../core/refs'
import type {
  ChatEntry,
  ChatMessage,
  ChatProposalBasis,
  ChatProposalMessage,
  ChatProposalRow,
  ChatSegment,
  RefChipData,
} from '../core/chat'
import Callout from './Callout.vue'
import Card from './Card.vue'
import ChatRefChip from './ChatRefChip.vue'
import Disclosure from './Disclosure.vue'
import Spinner from './Spinner.vue'
import Tool from './Tool.vue'

const props = withDefaults(
  defineProps<{
    messages: ChatEntry[]
    modelValue: string
    placeholder?: string
    queueLabel?: string
    sendLabel?: string
    applyLabel?: string
    /** How many recent messages to render. The log is append-only and never trimmed by the
     *  caller, so some cap matters for a conversation that runs long; both real consumers
     *  cap it differently (50 vs 60), hence a prop rather than a constant. */
    historyLimit?: number
    /** 'relay': Queue, Send and Apply reply, with the queued count. 'assistant': Send, and Stop
     *  while `busy`; it also turns on everything the props below describe. */
    actions?: 'relay' | 'assistant'
    /** A request is in flight: Send is disabled and Stop is shown. Assistant only. */
    busy?: boolean
    /** A line shown under every agent text message, and absent when empty. Assistant only. */
    fixedLine?: string
    /** A line shown on every proposal card. Assistant only. */
    proposalLine?: string
    /** The app's answer for a reference (`scope:path`): what to show in the chip, or null when it
     *  cannot resolve it. Absent means every reference is the warning chip. Assistant only. */
    resolveRef?: (ref: string) => RefChipData | null
    /** The reference scopes drawn as chips: what a `{{scope:path}}` may name. Assistant only. A
     *  scope outside this list is plain text. */
    refScopes?: ReferenceScopes
    /** The turn in progress, for the indicator above the compose box: the app's phase words and the
     *  moments it recorded on the page's clock (`Date.now()`). `awaitsApi` says the API is the party
     *  being waited for, which is when a quiet spell counts. `heardAt` is the last moment the API sent
     *  anything, or the request went out: the app sets it at send, at each `waiting` phase the loop
     *  reports, and at each `heard()` report, and the quiet notice counts from it. `note` is thinking
     *  text the app has already withheld for display; the panel shows it under the row, three lines at
     *  most, and adds no numeral rule of its own. Null when no turn runs. Assistant only. */
    activity?: { since: number; phase: string; heardAt?: number; awaitsApi?: boolean; note?: string } | null
    /** The words of the quiet notice, given the whole seconds since the API last sent anything. Absent,
     *  there is no notice. Assistant only. */
    quietText?: (seconds: number) => string
  }>(),
  {
    placeholder: 'Message…',
    queueLabel: 'Queue',
    sendLabel: 'Send',
    applyLabel: 'Apply reply',
    historyLimit: 50,
    actions: 'relay',
    busy: false,
    fixedLine: '',
    proposalLine: '',
    resolveRef: undefined,
    refScopes: () => DEFAULT_REFERENCE_SCOPES,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  queue: []
  send: []
  stop: []
  accept: [proposalId: string]
  discard: [proposalId: string]
  'load-again': [proposalId: string]
  'open-ref': [ref: string]
  'toggle-tool': [callId: string]
  'apply-reply': []
}>()

defineSlots<{
  /** The caller's copy for an empty log. */
  empty?: () => unknown
  /** Extra content inside each message, of any kind. Assistant only. */
  'message-extra'?: (props: { message: ChatEntry }) => unknown
}>()

/* The wording the assistant half draws itself. Fixed English, like the "how this works" heading
   above the empty slot; the three relay labels are props. */
const TEXT = {
  stop: 'Stop',
  accept: 'Accept',
  acceptDelete: 'Accept and delete',
  discard: 'Discard',
  loadAgain: 'Load again',
  destructive: 'Accepting this proposal deletes items.',
  done: 'Done',
  basis: { person: 'your words', file: 'file', list: 'list', suggestion: "assistant's suggestion" },
  details: 'Details',
  refusedBy: { engine: 'refused by the engine', api: 'refused by the API' },
  glyph: { running: '…', done: '✓', refused: '⊘', failed: '✕' },
} as const

const assistant = computed(() => props.actions === 'assistant')

const pending = computed(
  () => props.messages.filter((m) => isTextMessage(m) && m.role === 'you' && m.queued).length,
)
const visible = computed(() => props.messages.slice(-props.historyLimit))

/* ---- the activity indicator (assistant only) ----
 * The clock ticks once a second while a turn runs and stops when it ends. A tick moves only `clockNow`,
 * so it posts nothing: the status region receives one message when the phase changes and one when the
 * turn ends. */
const clockNow = ref(Date.now())
let clock: ReturnType<typeof setInterval> | null = null
watch(
  () => assistant.value && props.activity != null,
  (running) => {
    if (running) {
      clockNow.value = Date.now()
      clock = setInterval(() => (clockNow.value = Date.now()), 1000)
    } else if (clock !== null) {
      clearInterval(clock)
      clock = null
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (clock !== null) clearInterval(clock)
})
const elapsed = computed(() => (props.activity ? formatElapsed(clockNow.value - props.activity.since) : ''))
const quiet = computed(() => {
  const a = props.activity
  if (!a || !a.awaitsApi || a.heardAt === undefined || !props.quietText) return ''
  const seconds = quietSeconds(a.heardAt, clockNow.value)
  return seconds === null ? '' : props.quietText(seconds)
})
function say(text: string) {
  announcement.value = text
  posts.value++
}
watch(
  () => props.activity?.phase,
  (phase, was) => {
    if (phase !== undefined && phase !== was) say(phase)
  },
)
watch(
  () => props.activity == null,
  (ended, wasEnded) => {
    if (ended && !wasEnded) say(TEXT.done)
  },
)
function roleLabel(role: ChatMessage['role']) {
  return role === 'you' ? 'you' : role === 'agent' ? 'agent' : 'note'
}
// A proposal's basis column shows only when some row has a basis; a proposal with no basis is a
// three-column table.
function rowsHaveBasis(rows: ChatProposalRow[]): boolean {
  return rows.some((r) => r.basis != null)
}

function basisLabel(basis: ChatProposalBasis): string {
  return TEXT.basis[basis.kind]
}
// The label, then the text after a colon. A basis with no text shows its label alone: a colon with
// nothing after it reads as a broken row.
function basisText(basis: ChatProposalBasis): string {
  return basis.text ? basisLabel(basis) + ': ' + basis.text : basisLabel(basis)
}

function acceptLabel(m: ChatProposalMessage): string {
  return m.destructive ? TEXT.acceptDelete : TEXT.accept
}

function refsLabel(refs: string[]) {
  return (refs.length > 1 ? 'refs' : 'ref') + ': ' + refs.join(' · ')
}

/* ---- what an assistant text message is made of ---- */

type Part =
  | { type: 'text'; text: string }
  | { type: 'mark'; text: string; kind: string }
  | { type: 'ref'; ref: string }

/* References are read in agent messages only. A person's own words, or a system note, that happen
   to contain braces stay exactly as written. */
function segmentsOf(m: ChatMessage): ChatSegment[] {
  if (m.role === 'agent') return splitReferences(m.text, props.refScopes)
  return m.text ? [{ kind: 'text', text: m.text, start: 0, end: m.text.length }] : []
}

/* The marks that can be drawn: whole spans inside the text, in order, none overlapping. The app's
   gate decides what to mark; a malformed span is dropped here rather than thrown, so one bad
   offset cannot blank a reply. */
function usableMarks(m: ChatMessage) {
  const sorted = (m.marks ?? [])
    .filter(
      (k) =>
        Number.isInteger(k.start) && Number.isInteger(k.end) && k.start >= 0 && k.start < k.end && k.end <= m.text.length,
    )
    .sort((a, b) => a.start - b.start)
  const out: typeof sorted = []
  let edge = 0
  for (const k of sorted) {
    if (k.start < edge) continue
    out.push(k)
    edge = k.end
  }
  return out
}

function partsOf(m: ChatMessage): Part[] {
  const marks = usableMarks(m)
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

/* ---- the log: following it, and announcing a reply once ---- */

const logEl = ref<HTMLElement | null>(null)
function scrollToBottom() {
  return nextTick(() => {
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  })
}

// auto-scroll on every new message, so the caller never has to reach into the DOM for this; under
// 'assistant' the snapshot watcher below decides
watch(
  () => props.messages.length,
  () => {
    if (!assistant.value) scrollToBottom()
  },
)

/* What the screen reader is told when a streaming reply settles: the settled text, with each
   reference read as its chip's accessible name. One persistent live region, posted to once per
   settled reply. It exists from the first render, empty: a live region that is inserted already
   holding its text is the case assistive technology most often misses.
   Each post is a NEW child of the region (the key changes), not new text in the old one. A reply
   that settles with exactly the words of the one before it changes no text, and a region whose text
   did not change announces nothing; an added node is announced every time. */
const announcement = ref('')
const posts = ref(0)

function announce(m: ChatMessage) {
  announcement.value = segmentsOf(m)
    .map((s) => (s.kind === 'ref' ? describeRef(s.ref, resolve(s.ref)).name : s.text))
    .join('')
  posts.value++
}

/* One watcher serves every assistant scroll rule. It runs BEFORE the render that changes the log,
   which is the only moment "was the reader at the bottom" can be measured: afterwards the new text
   has already pushed the edge away and every reader looks scrolled up.
   A message is followed while it streams, and for the update that settles it, so a last token that
   arrives together with the end of the stream is not lost. Growth of a message that is not
   streaming is not followed.
   A change of messages.length scrolls from anywhere when nothing is streaming, and when the new
   entry is the reader's own message. While an entry streams, a tool card or a proposal appended
   to the log goes through the same at-bottom test as the stream, so a reader who scrolled up is
   not pulled down. */
type Snapshot = { streaming: boolean; length: number } | null
/* Empty under relay, so a relay host pays nothing for it and its reactive reads are not tracked. */
const snapshot = (): Snapshot[] =>
  assistant.value
    ? props.messages.map((m) => (isTextMessage(m) ? { streaming: !!m.streaming, length: m.text.length } : null))
    : []
let last = snapshot()
watch(
  snapshot,
  (now) => {
    const was = last
    last = now
    if (!assistant.value) return
    const el = logEl.value
    const atBottom = !!el && el.scrollHeight - el.scrollTop - el.clientHeight <= STREAM_FOLLOW_THRESHOLD
    let grew = false
    now.forEach((n, i) => {
      const w = was[i]
      if (!n || !w) return
      if ((n.streaming || w.streaming) && n.length > w.length) grew = true
      const m = props.messages[i]
      if (w.streaming && !n.streaming && m && isTextMessage(m)) announce(m)
    })
    const lengthChanged = now.length !== was.length
    const streamed = was.some((w) => w?.streaming) || now.some((n) => n?.streaming)
    const own = lengthChanged && props.messages.slice(was.length).some((m) => isTextMessage(m) && m.role === 'you')
    if ((lengthChanged && (own || !streamed)) || ((grew || lengthChanged) && atBottom)) scrollToBottom()
  },
  { flush: 'pre' },
)

/* Ctrl/Cmd+Enter is the primary action's shortcut: Queue for the relay hosts, Send here. */
function onShortcut() {
  if (!assistant.value) emit('queue')
  else if (!props.busy) emit('send')
}

const textareaEl = ref<HTMLTextAreaElement | null>(null)
/* A host with an "ask about this" shortcut needs to both prefill the compose box (via
 * v-model, from outside) and focus it in one call: the same need SearchField's expose
 * solves for its input. */
defineExpose({ focus: () => textareaEl.value?.focus() })
</script>

<template>
  <div class="aether-chat">
    <div ref="logEl" class="aether-chat__log" :class="{ 'aether-chat__log--assistant': assistant }">
      <div v-if="!messages.length" class="aether-chat__msg aether-chat__msg--sys">
        <span class="aether-chat__who">how this works</span>
        <slot name="empty" />
      </div>
      <template v-for="(m, i) in visible" :key="i">
        <div
          v-if="isTextMessage(m)"
          class="aether-chat__msg"
          :class="[`aether-chat__msg--${m.role}`, { queued: m.queued }]"
          :aria-busy="assistant && m.streaming ? 'true' : undefined"
        >
          <span class="aether-chat__who">{{ roleLabel(m.role) }}{{ m.queued ? ' · queued' : '' }}</span>
          <span class="aether-chat__txt"
            ><template v-if="!assistant">{{ m.text }}</template
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
          <p v-if="assistant && fixedLine && m.role === 'agent'" class="aether-chat__fixed">{{ fixedLine }}</p>
          <slot v-if="assistant" name="message-extra" :message="m" />
        </div>

        <div
          v-else-if="assistant && m.kind === 'tool'"
          class="aether-chat__msg aether-chat__tool"
        >
          <div class="aether-chat__tool-head">
            <span class="aether-chat__tool-name">{{ m.name }}</span>
            <span class="aether-chat__state" :data-state="m.status"
              ><span class="aether-chat__glyph" aria-hidden="true">{{ TEXT.glyph[m.status] }}</span
              >{{ m.status }}</span
            >
          </div>
          <p class="aether-chat__tool-summary" :title="m.summary">{{ m.summary }}</p>
          <Disclosure
            v-if="m.detail"
            class="aether-chat__tool-detail"
            :label="TEXT.details"
            :open="!!m.open"
            @update:open="emit('toggle-tool', m.callId)"
          >
            <!-- Disclosure clips its body at a fixed ceiling, so a long detail scrolls inside its own
                 box and its whole text stays reachable. The box is a named tab stop so the keyboard
                 gets there, and a group rather than a landmark. -->
            <pre
              class="aether-chat__detail"
              role="group"
              tabindex="0"
              :aria-label="m.name + ' detail'"
            >{{ m.detail }}</pre>
          </Disclosure>
          <slot name="message-extra" :message="m" />
        </div>

        <div
          v-else-if="assistant && m.kind === 'refusal'"
          class="aether-chat__msg aether-chat__refusal"
        >
          <span class="aether-chat__who">{{ TEXT.refusedBy[m.source] }}</span>
          <pre class="aether-chat__refusal-text">{{ m.text }}</pre>
          <slot name="message-extra" :message="m" />
        </div>

        <div
          v-else-if="assistant && m.kind === 'proposal'"
          class="aether-chat__msg aether-chat__proposal"
        >
          <div class="aether-chat__proposal-head">
            <span class="aether-chat__proposal-title">{{ m.title }}</span>
            <span class="aether-chat__state" :data-state="m.status">{{ m.status }}</span>
          </div>
          <!-- A scroll container is a named tab stop, or a keyboard user cannot reach the rows past the
               fold; a group rather than a landmark. The kit renders every row: the cap, if any, is
               the app's. -->
          <p v-if="m.destructive" class="aether-chat__proposal-destructive">{{ TEXT.destructive }}</p>
          <div class="aether-chat__rows" role="group" tabindex="0" :aria-label="m.title + ' rows'">
            <table class="aether-chat__diff">
              <thead>
                <tr>
                  <th scope="col">path</th>
                  <th scope="col">before</th>
                  <th scope="col">after</th>
                  <th v-if="rowsHaveBasis(m.rows)" scope="col">basis</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, k) in m.rows" :key="k">
                  <th scope="row">{{ r.path }}</th>
                  <td>
                    <del class="aether-chat__before">{{ r.before }}</del>
                  </td>
                  <td>
                    <ins class="aether-chat__after"
                      ><span class="aether-chat__proposed">proposed</span>{{ r.after }}</ins
                    >
                  </td>
                  <td v-if="rowsHaveBasis(m.rows)">
                    <span v-if="r.basis" class="aether-chat__basis" :data-basis="r.basis.kind"
                      >{{ basisText(r.basis) }}</span
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout v-for="(f, k) in m.flags" :key="k" class="aether-chat__flag" tone="warning">
            {{ f.text }}
            <ChatRefChip :reference="f.reference" :data="resolve(f.reference)" @open="emit('open-ref', $event)" />
          </Callout>
          <p v-if="proposalLine" class="aether-chat__proposal-line">{{ proposalLine }}</p>
          <div v-if="m.status === 'pending'" class="aether-chat__proposal-actions">
            <Tool :label="acceptLabel(m)" hot @click="emit('accept', m.id)" />
            <Tool :label="TEXT.discard" @click="emit('discard', m.id)" />
          </div>
          <div v-else-if="m.later" class="aether-chat__proposal-actions">
            <Tool v-if="m.later === 'accept'" :label="acceptLabel(m)" hot @click="emit('accept', m.id)" />
            <Tool v-else :label="TEXT.loadAgain" @click="emit('load-again', m.id)" />
          </div>
          <slot name="message-extra" :message="m" />
        </div>

        <Card v-else-if="assistant && m.kind === 'card'" class="aether-chat__card">
          <p class="aether-chat__card-title">{{ m.title }}</p>
          <p class="aether-chat__card-body">{{ m.body }}</p>
          <p class="aether-chat__source">source: {{ m.source }}</p>
          <slot name="message-extra" :message="m" />
        </Card>
      </template>
      <!-- Assistant only, and present from the first render: see `announcement`. -->
      <div v-if="assistant" class="aether-chat__sr" role="status"><span :key="posts">{{ announcement }}</span></div>
    </div>
    <div v-if="assistant && activity" class="aether-chat__activity">
      <Spinner class="aether-chat__activity-spinner" :size="14" />
      <span class="aether-chat__activity-phase">{{ activity.phase }}</span>
      <span class="aether-chat__activity-time" aria-hidden="true">{{ elapsed }}</span>
      <span v-if="quiet" class="aether-chat__activity-quiet">{{ quiet }}</span>
      <p v-if="activity.note" class="aether-chat__activity-note">{{ activity.note }}</p>
    </div>
    <div class="aether-chat__compose">
      <textarea
        ref="textareaEl"
        :value="modelValue"
        :placeholder="placeholder"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @keydown.enter.ctrl.prevent="onShortcut"
        @keydown.enter.meta.prevent="onShortcut"
      ></textarea>
      <div class="aether-chat__actions">
        <template v-if="assistant">
          <Tool :label="sendLabel" hot :disabled="busy" @click="emit('send')" />
          <Tool v-if="busy" :label="TEXT.stop" @click="emit('stop')" />
        </template>
        <template v-else>
          <Tool :label="queueLabel" hot @click="emit('queue')" />
          <Tool :label="sendLabel" @click="emit('send')" />
          <Tool :label="applyLabel" @click="emit('apply-reply')" />
          <span class="aether-chat__hint">{{ pending ? pending + ' queued' : 'nothing queued' }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The indicator above the compose box. The spinner stands still under reduced motion. The Spinner
   component keeps turning, more slowly, for its other callers, and this rule does not touch them.
   The phase text and the time stay. */
.aether-chat__activity {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 16px 0;
  color: var(--aether-ink-soft);
  font-size: 0.92em;
  flex-wrap: wrap;
}
@media (prefers-reduced-motion: reduce) {
  .aether-chat__activity .aether-spinner {
    animation: none;
  }
}
.aether-chat__activity-time {
  font-variant-numeric: tabular-nums;
}
/* The quiet notice takes a row of its own under the phase, as the thinking note does. */
.aether-chat__activity-quiet {
  flex-basis: 100%;
}
/* The thinking note takes a row of its own under the phase, and stops at three lines. */
.aether-chat__activity-note {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.85em;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}
/* The relay hosts' rules live in ui-kit.css. Everything here belongs to the assistant half, and its
   CSS is scoped to this component. */

/* The live region is out of flow, so it adds neither a flex gap nor scroll extent, and the log is
   its containing block so it cannot position against some distant ancestor. Visually hidden, not
   display: none: that would remove it from the accessibility tree, which is its whole job. The
   same clip stands behind a mark's label of its kind. */
.aether-chat__log--assistant {
  position: relative;
}
.aether-chat__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

/* ---- text ---- */
/* A highlight is a box AND a wavy underline: the underline survives a greyscale print and a
   colour-blind reader, the tone is for everyone else. */
.aether-chat__mark {
  padding: 0 1px;
  border-radius: 2px;
  background: var(--aether-tone-warning-wash);
  color: inherit;
  text-decoration: underline wavy var(--aether-tone-warning);
  text-underline-offset: 2px;
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
.aether-chat__fixed {
  margin: 8px 0 0;
  padding-top: 6px;
  border-top: 1px solid var(--aether-line);
  color: var(--aether-ink-soft);
  font-size: 11.5px;
}

/* ---- cards that are not bubbles ---- */
.aether-chat__tool,
.aether-chat__refusal,
.aether-chat__proposal {
  align-self: flex-start;
  background: var(--aether-surface);
  border: 1px solid var(--aether-line);
}
.aether-chat__proposal {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

/* The tone is a left rule on the pill, and the state's word does not depend on it. */
.aether-chat__state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border: 1px solid var(--aether-line-strong);
  border-left: 3px solid var(--state-tone, var(--aether-ink-soft));
  border-radius: 999px;
  color: var(--aether-ink);
  font-family: var(--aether-font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.7;
  text-transform: uppercase;
}
.aether-chat__state[data-state='done'],
.aether-chat__state[data-state='accepted'] {
  --state-tone: var(--aether-tone-success);
}
.aether-chat__state[data-state='refused'] {
  --state-tone: var(--aether-tone-warning);
}
.aether-chat__state[data-state='failed'] {
  --state-tone: var(--aether-tone-danger);
}
.aether-chat__state[data-state='pending'] {
  --state-tone: var(--aether-tone-info);
}
.aether-chat__glyph {
  color: var(--state-tone, var(--aether-ink-soft));
}

/* ---- tool call ---- */
.aether-chat__tool-head,
.aether-chat__proposal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.aether-chat__tool-name {
  font-family: var(--aether-font-mono);
  font-weight: 600;
}
.aether-chat__tool-summary {
  margin: 4px 0 0;
  overflow: hidden;
  color: var(--aether-ink-soft);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.aether-chat__tool-detail {
  margin-top: 8px;
}
.aether-chat__detail {
  max-height: 20em;
  margin: 0;
  overflow: auto;
  font-family: var(--aether-font-mono);
  font-size: 11.5px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.aether-chat__detail:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 1px;
}

/* ---- refusal: monospace and ruled, so it cannot be read as the assistant's own reply ---- */
.aether-chat__refusal {
  border-left: 3px solid var(--aether-tone-danger);
  background: var(--aether-tone-danger-wash);
}
/* The 9px label sits on the danger wash, where --aether-faint is the tightest pair, so it takes the
   stronger grey; contrast.test.ts holds the pair. */
.aether-chat__refusal .aether-chat__who {
  color: var(--aether-ink-soft);
}
.aether-chat__refusal-text {
  margin: 0;
  color: var(--aether-ink);
  font-family: var(--aether-font-mono);
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* ---- proposal ---- */
.aether-chat__proposal-title {
  font-weight: 600;
}
.aether-chat__rows {
  max-height: 15em;
  margin: 8px 0;
  overflow: auto;
  border: 1px solid var(--aether-line);
  border-radius: var(--aether-radius);
}
.aether-chat__rows:focus-visible {
  outline: 2px solid var(--aether-cool);
  outline-offset: 1px;
}
.aether-chat__diff {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--aether-font-mono);
  font-size: 11.5px;
}
.aether-chat__diff th,
.aether-chat__diff td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--aether-line);
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}
.aether-chat__diff thead th {
  position: sticky;
  top: 0;
  background: var(--aether-panel);
  color: var(--aether-ink-soft);
  font-size: 9px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
.aether-chat__diff tbody th {
  font-weight: 600;
}
.aether-chat__before {
  color: var(--aether-ink-soft);
}
.aether-chat__after {
  background: var(--aether-tone-success-wash);
  text-decoration: none;
}
.aether-chat__proposed {
  margin-right: 6px;
  padding: 0 4px;
  border: 1px solid var(--aether-tone-success);
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.aether-chat__flag {
  margin-top: 6px;
}
.aether-chat__proposal-line {
  margin: 8px 0 0;
  color: var(--aether-ink-soft);
}
.aether-chat__proposal-destructive {
  margin: 6px 0 0;
  font-weight: 600;
}
.aether-chat__proposal-actions {
  display: flex;
  gap: 7px;
  margin-top: 8px;
}

/* ---- card ---- */
.aether-chat__card {
  align-self: flex-start;
  max-width: 92%;
  font-size: 12.8px;
  line-height: 1.5;
}
.aether-chat__card-title {
  margin: 0 0 4px;
  font-weight: 600;
}
.aether-chat__card-body {
  margin: 0;
  white-space: pre-wrap;
}
.aether-chat__source {
  margin: 8px 0 0;
  color: var(--aether-faint);
  font-family: var(--aether-font-mono);
  font-size: 10px;
}
</style>
