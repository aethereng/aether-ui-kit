<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE: rendered as the demo and sliced for the Template/Script tabs. */
import { onBeforeUnmount, ref } from 'vue'
import ChatPanel from '@aether/ui-kit/controls/chat-panel'
import Tool from '@aether/ui-kit/controls/tool'
import { findBareNumerals } from '@aether/ui-kit/controls/core'
import type { ChatMessage, RefChipData } from '@aether/ui-kit/controls/core'

/* Controlled: the caller owns the log and the compose box. The panel renders and emits, and
   never invents a message. `queued` on a 'you' message is what drives the count on Send. */
const messages = ref<ChatMessage[]>([{ role: 'reply', text: 'Ready when you are.' }])
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
  messages.value.push({ role: 'reply', text: 'Done. See the diff.' })
}

/* ---- a rich log: markdown, reference chips, marks, a stream, and the caller's additions ---- */

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
}
const resolveRef = (ref: string): RefChipData | null => index[ref] ?? null

/* The panel judges nothing. The app's own gate finds the bare numerals and hands the panel their
   spans; here that gate is the core's rule with no identifier admitted. */
function replyText(text: string): ChatMessage {
  const marks = findBareNumerals(text, []).map((s) => ({ ...s, kind: 'bare numeral' }))
  return { role: 'reply', text, marks }
}

/* An entry of this page's own kind. The panel draws none of it: the `entry` slot does, where it stands
   in the log. */
type Notice = { kind: 'notice'; title: string; body: string }
type Entry = ChatMessage | Notice

const richCompose = ref('')
const richMessages = ref<Entry[]>([
  { role: 'you', text: 'Example request: compare the two results.' },
  replyText(
    'The **maximum** is {{r1:result.max}} and the mean is {{r1:result.mean}}, and {{r9:result.missing}} ' +
      'has no answer. A rough figure of 12 units has no source.',
  ),
  { kind: 'notice', title: 'Example notice', body: 'Drawn by the page through the entry slot.' },
])
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

function onRichSend() {
  if (busy.value) return
  const t = richCompose.value.trim()
  if (t) richMessages.value.push({ role: 'you', text: t })
  richCompose.value = ''
  richMessages.value.push({ role: 'reply', text: '', streaming: true })
  live = richMessages.value[richMessages.value.length - 1] as ChatMessage
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
      placeholder="Write a request…"
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
    <code>rich</code> reads a reply as markdown with reference chips and marked numerals. This page adds
    the rest: a notice of its own through <code>#entry</code>, a line through <code>#above-compose</code>
    while the reply streams, and Send and Stop through <code>#actions</code>.
  </p>

  <div class="g-chat g-chat--rich">
    <ChatPanel
      v-model="richCompose"
      rich
      shortcut="send"
      :messages="richMessages"
      :resolve-ref="resolveRef"
      placeholder="Write a request…"
      @send="onRichSend"
      @open-ref="opened = $event"
    >
      <template #entry="{ entry }">
        <p class="g-chat-notice"><b>{{ entry.title }}</b> {{ entry.body }}</p>
      </template>
      <template #above-compose>
        <p v-if="busy" class="g-chat-busy">A reply is arriving.</p>
      </template>
      <template #actions>
        <Tool label="Send" hot :disabled="busy" @click="onRichSend" />
        <Tool v-if="busy" label="Stop" @click="finish" />
      </template>
    </ChatPanel>
  </div>

  <code class="g-ex-state">open-ref = {{ opened }}</code>
</template>
