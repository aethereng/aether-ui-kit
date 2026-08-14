<script setup lang="ts">
/* THIS FILE IS THE EXAMPLE — rendered as the demo and sliced for the Template/Script tabs. */
import { ref } from 'vue'
import ChatPanel from '@aether/ui-kit/controls/chat-panel'
import type { ChatMessage } from '@aether/ui-kit/controls/core'

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
    text: 'Sent ' + reqs.length + ' request(s) — exported as request.json.',
  })
}

/* A host calls this after importing a reply file; here it hands back a canned response. */
function onApplyReply() {
  messages.value.push({ role: 'agent', text: 'Done — see the diff.' })
}
</script>

<template>
  <p class="g-hint">
    Type a line, hit Queue, then Send — the count on the button clears and a system note lands in
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
      <!-- #empty is the caller's copy for an empty log — the kit ships no default wording -->
      <template #empty>Queue a message, then Send to export a request file.</template>
    </ChatPanel>
  </div>

  <code class="g-ex-state">
    messages = {{ messages.length }} · queued =
    {{ messages.filter((m) => m.role === 'you' && m.queued).length }}
  </code>
</template>
