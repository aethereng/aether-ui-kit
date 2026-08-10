<script setup lang="ts">
/* A message log + compose box for the "queue instructions, export a request file, apply the
 * reply" pattern used by every surface that talks to an agent. Extracted after two hosts
 * (a file browser, a card board) shipped it identically — same log shape, same three
 * buttons, same Ctrl/Cmd+Enter-to-queue binding, same "queued" dashed state — with only the
 * export/import logic actually differing between them. That is the split this component
 * draws: it owns the log and the compose box; the caller owns what Send and Apply reply DO.
 *
 * Controlled, like the rest of the kit: the caller owns both the message list and the
 * compose string. ChatPanel renders + emits; it never writes to either itself. */
import { computed, nextTick, ref, watch } from 'vue'
import type { ChatMessage } from '../core'
import Tool from './Tool.vue'

const props = withDefaults(
  defineProps<{
    messages: ChatMessage[]
    modelValue: string
    placeholder?: string
    queueLabel?: string
    sendLabel?: string
    applyLabel?: string
    /** How many recent messages to render. The log is append-only and never trimmed by the
     *  caller, so some cap matters for a conversation that runs long; both real consumers
     *  cap it differently (50 vs 60), hence a prop rather than a constant. */
    historyLimit?: number
  }>(),
  {
    placeholder: 'Message…',
    queueLabel: 'Queue',
    sendLabel: 'Send',
    applyLabel: 'Apply reply',
    historyLimit: 50,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  queue: []
  send: []
  'apply-reply': []
}>()

const pending = computed(
  () => props.messages.filter((m) => m.role === 'you' && m.queued).length,
)
const visible = computed(() => props.messages.slice(-props.historyLimit))
function roleLabel(role: ChatMessage['role']) {
  return role === 'you' ? 'you' : role === 'agent' ? 'agent' : 'note'
}
function refsLabel(refs: string[]) {
  return (refs.length > 1 ? 'refs' : 'ref') + ': ' + refs.join(' · ')
}

// auto-scroll on every new message, so the caller never has to reach into the DOM for this
const logEl = ref<HTMLElement | null>(null)
watch(
  () => props.messages.length,
  () => nextTick(() => { if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight }),
)

const textareaEl = ref<HTMLTextAreaElement | null>(null)
/* A host with an "ask about this" shortcut needs to both prefill the compose box (via
 * v-model, from outside) and focus it in one call — the same need SearchField's expose
 * solves for its input. */
defineExpose({ focus: () => textareaEl.value?.focus() })
</script>

<template>
  <div class="aether-chat">
    <div ref="logEl" class="aether-chat__log">
      <div v-if="!messages.length" class="aether-chat__msg aether-chat__msg--sys">
        <span class="aether-chat__who">how this works</span>
        <slot name="empty" />
      </div>
      <div
        v-for="(m, i) in visible"
        :key="i"
        class="aether-chat__msg"
        :class="[`aether-chat__msg--${m.role}`, { queued: m.queued }]"
      >
        <span class="aether-chat__who">{{ roleLabel(m.role) }}{{ m.queued ? ' · queued' : '' }}</span>
        <span class="aether-chat__txt">{{ m.text }}</span>
        <div v-if="m.refs?.length" class="aether-chat__ref">{{ refsLabel(m.refs) }}</div>
      </div>
    </div>
    <div class="aether-chat__compose">
      <textarea
        ref="textareaEl"
        :value="modelValue"
        :placeholder="placeholder"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @keydown.enter.ctrl.prevent="emit('queue')"
        @keydown.enter.meta.prevent="emit('queue')"
      ></textarea>
      <div class="aether-chat__actions">
        <Tool :label="queueLabel" hot @click="emit('queue')" />
        <Tool :label="sendLabel" @click="emit('send')" />
        <Tool :label="applyLabel" @click="emit('apply-reply')" />
        <span class="aether-chat__hint">{{ pending ? pending + ' queued' : 'nothing queued' }}</span>
      </div>
    </div>
  </div>
</template>
