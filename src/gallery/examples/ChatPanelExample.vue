<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE: rendered as the demo and sliced for the Template/Script tabs. */
import { computed, onBeforeUnmount, ref } from 'vue'
import ChatPanel from '@aether/ui-kit/controls/chat-panel'
import { findBareNumerals } from '@aether/ui-kit/controls/core'
import type {
  ChatEntry,
  ChatMessage,
  ChatProposalMessage,
  ChatToolMessage,
  RefChipData,
} from '@aether/ui-kit/controls/core'

/* Controlled: the caller owns the log and the compose box. The panel renders and emits, and
   never invents a message. `queued` on a 'you' message is what drives the count on Send. */
const messages = ref<ChatMessage[]>([{ role: 'agent', text: 'Ready when you are.' }])
const compose = ref('')

function onQueue() {
  const t = compose.value.trim()
  if (!t) return
  messages.value.push({ role: 'you', text: t, queued: true })
  compose.value = ''
}

function onSend() {
  const reqs = messages.value.filter((m) => m.role === 'you' && m.queued)
  if (!reqs.length) return
  reqs.forEach((m) => (m.queued = false))
  messages.value.push({
    role: 'sys',
    text: 'Sent ' + reqs.length + ' request(s): exported as request.json.',
  })
}

/* A host calls this after importing a reply file; here it hands back a canned response. */
function onApplyReply() {
  messages.value.push({ role: 'agent', text: 'Done. See the diff.' })
}

/* ---- actions="assistant": one request at a time, a log of more than text ---- */

/* What a reference points at is the app's to say. `resolveRef` is called while the log renders, so
   it is a lookup; null means "I cannot resolve this", and the panel draws the warning chip. */
const index: Record<string, RefChipData> = {
  'r1:result.max': {
    value: '0.0123',
    unit: 'm',
    source: { kind: 'run', id: 'r1', hash: '3b1f2c9d4e5a6b7c' },
    path: 'result.max',
    provenance: 'Example provenance line.',
  },
  'r1:result.mean': {
    value: '0.0041',
    unit: 'm',
    source: { kind: 'run', id: 'r1', hash: '3b1f2c9d4e5a6b7c' },
    path: 'result.mean',
    provenance: 'Example provenance line.',
    reduced: true,
  },
  'c:limit.value': {
    value: '1.37',
    unit: null,
    source: { kind: 'capabilities', id: null, hash: '9c04e2d11223344' },
    path: 'limit.value',
    provenance: null,
  },
}
const resolveRef = (ref: string): RefChipData | null => index[ref] ?? null

/* The panel judges nothing. The app's own gate finds the bare numerals and hands the panel their
   spans; here that gate is the core's rule with no identifier admitted. */
function agentText(text: string): ChatMessage {
  const marks = findBareNumerals(text, []).map((s) => ({ ...s, kind: 'bare numeral' }))
  return { role: 'agent', text, marks }
}

const assistantCompose = ref('')
const assistantMessages = ref<ChatEntry[]>([
  { role: 'you', text: 'Example request: compare the two results.' },
  agentText(
    'The maximum is {{r1:result.max}} and the mean is {{r1:result.mean}}. The limit is ' +
      '{{c:limit.value}}, and {{r9:result.missing}} has no answer. A rough figure of 12 units has no source.',
  ),
  {
    kind: 'tool',
    callId: 'call-1',
    name: 'example_lookup',
    status: 'done',
    summary: 'Example summary of what the call returned.',
    detail: `Example detail, line one.
  Example detail, line two.`,
    open: false,
  },
  { kind: 'tool', callId: 'call-2', name: 'example_check', status: 'failed', summary: 'Example failure summary.' },
  { kind: 'refusal', source: 'engine', text: `Example refusal text.
  An indented second line, kept as written.` },
  {
    kind: 'proposal',
    id: 'proposal-1',
    title: 'Example proposal',
    status: 'pending',
    rows: [
      { path: 'example.row_a', before: '1', after: '2' },
      { path: 'example.row_b', before: 'off', after: 'on' },
      { path: 'example.row_c', before: '0.5', after: '0.75' },
      { path: 'example.row_d', before: 'none', after: 'set' },
      { path: 'example.row_e', before: 'a', after: 'b' },
      { path: 'example.row_f', before: '10', after: '12' },
    ],
    flags: [{ text: 'Example flag, with the value it concerns:', reference: 'r1:result.max' }],
  },
  { kind: 'card', title: 'Example card', body: 'Example card body.', source: 'example source' },
])

/* Accept, Discard and the Details toggle only ASK. Nothing on screen changes until this code
   changes the message, which is what "controlled" means for a card that can be acted on. */
const proposalById = (id: string) =>
  assistantMessages.value.find((e): e is ChatProposalMessage => e.kind === 'proposal' && e.id === id)
const toolById = (id: string) =>
  assistantMessages.value.find((e): e is ChatToolMessage => e.kind === 'tool' && e.callId === id)

function onAccept(id: string) {
  const p = proposalById(id)
  if (p) p.status = 'accepted'
}
function onDiscard(id: string) {
  const p = proposalById(id)
  if (p) p.status = 'discarded'
}
function onToggleTool(id: string) {
  const t = toolById(id)
  if (t) t.open = !t.open
}

const proposalStatus = computed(() => proposalById('proposal-1')?.status ?? 'none')
const opened = ref('none yet')

/* A stream the app drives: it grows one message in place and clears `streaming` when it ends. Cut
   mid-reference on purpose, so the chip only appears once its braces have closed. Scroll up while
   it runs and the log stays where you left it; stay at the bottom and it follows. */
const STREAM =
  'A streamed reply can name {{r1:result.max}} and the chip appears once its braces close. ' +
  'Scroll up while this runs: the log stays where you left it. {{r9:result.missing}} stays unresolved.'
const busy = ref(false)
let live: ChatMessage | undefined
let timer: ReturnType<typeof setInterval> | undefined

function finish() {
  clearInterval(timer)
  if (live) live.streaming = false
  live = undefined
  busy.value = false
}

function onAssistantSend() {
  if (busy.value) return
  const t = assistantCompose.value.trim()
  if (t) assistantMessages.value.push({ role: 'you', text: t })
  assistantCompose.value = ''
  assistantMessages.value.push({ role: 'agent', text: '', streaming: true })
  live = assistantMessages.value[assistantMessages.value.length - 1] as ChatMessage
  busy.value = true
  let shown = 0
  timer = setInterval(() => {
    shown += 5
    live!.text = STREAM.slice(0, shown)
    if (shown >= STREAM.length) finish()
  }, 60)
}
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <p class="g-hint">
    Type a line, hit Queue, then Send; the count on the button clears and a system note lands in
    the log. Apply reply hands back a canned response, the way a real host would after importing a
    reply file.
  </p>

  <div class="g-chat">
    <ChatPanel
      v-model="compose"
      :messages="messages"
      placeholder="Ask the agent…"
      @queue="onQueue"
      @send="onSend"
      @apply-reply="onApplyReply"
    >
      <!-- #empty is the caller's copy for an empty log: the kit ships no default wording -->
      <template #empty>Queue a message, then Send to export a request file.</template>
    </ChatPanel>
  </div>

  <code class="g-ex-state">
    messages = {{ messages.length }} · queued =
    {{ messages.filter((m) => m.role === 'you' && m.queued).length }}
  </code>

  <p class="g-hint g-hint--spaced">
    <code>actions="assistant"</code> shows Send and, while busy, Stop, and the log renders every
    kind on one screen: text with reference chips and marked numerals, tool calls, a refusal, a
    proposal and a card. Send streams a reply; Accept and Discard only ask, and the status changes
    when this page changes it.
  </p>

  <div class="g-chat g-chat--assistant">
    <ChatPanel
      v-model="assistantCompose"
      actions="assistant"
      :messages="assistantMessages"
      :busy="busy"
      fixed-line="Example fixed line."
      proposal-line="Example proposal line."
      :resolve-ref="resolveRef"
      placeholder="Ask the assistant…"
      @send="onAssistantSend"
      @stop="finish"
      @accept="onAccept"
      @discard="onDiscard"
      @toggle-tool="onToggleTool"
      @open-ref="opened = $event"
    />
  </div>

  <code class="g-ex-state">proposal = {{ proposalStatus }} · open-ref = {{ opened }}</code>
</template>
