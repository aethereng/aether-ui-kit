import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ChatPanel from '../ChatPanel.vue'
import type { ChatEntry, ChatProposalBasis, ChatProposalMessage, ChatProposalRow, RefChipData } from '../../core'

/* The proposal card's basis column, its destructive wording and its later action, and the chips a
 * reply draws with the scope list the panel is given. The relay contract stays in ChatPanel.dom.test.ts,
 * and the assistant's own rendering in ChatPanel.assistant.dom.test.ts; neither changes here. */

const row = (path: string, basis?: ChatProposalBasis): ChatProposalRow => ({
  path,
  before: '1',
  after: '2',
  ...(basis ? { basis } : {}),
})

const card = (over: Partial<ChatProposalMessage>): ChatProposalMessage => ({
  kind: 'proposal',
  id: 'p1',
  title: 'Change',
  rows: [row('elements[e1].profile')],
  flags: [],
  status: 'pending',
  ...over,
})

const VERIFICATION: RefChipData = {
  value: 'OK',
  unit: null,
  source: { kind: 'verification', id: 'v1', hash: 'a1b2c3d4e5f6' },
  path: 'members[e1].status',
  provenance: null,
}
const LOWER: RefChipData = {
  value: '0.42',
  unit: null,
  mark: '(lower bound)',
  source: { kind: 'run', id: 'r1', hash: '3b1f2c9d4e5a' },
  path: 'summary.utilisation',
  provenance: null,
}
const RESOLVE: Record<string, RefChipData> = {
  'v1:members[e1].status': VERIFICATION,
  'r1:summary.utilisation': LOWER,
}

const SECOND_SCOPES = { indexed: ['m', 'p', 'r', 'v', 'f'], bare: ['c', 'g'] }

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

function mountPanel(messages: ChatEntry[], extra: Record<string, unknown> = {}) {
  wrapper = mount(ChatPanel, {
    props: {
      messages,
      modelValue: '',
      actions: 'assistant',
      resolveRef: (ref: string) => RESOLVE[ref] ?? null,
      ...extra,
    },
  })
  return wrapper
}

const buttonByText = (w: VueWrapper, text: string) => w.findAll('button').find((b) => b.text() === text)

describe('K8: the proposal basis column', () => {
  it('shows a basis column only when a row carries a basis', () => {
    const plain = mountPanel([card({ rows: [row('a')] })])
    expect(plain.findAll('th').map((t) => t.text())).not.toContain('basis')
    plain.unmount()
    const based = mountPanel([card({ rows: [row('a', { kind: 'person', text: 'from the engineer' })] })])
    expect(based.findAll('th').map((t) => t.text())).toContain('basis')
  })

  it("labels a suggestion as the assistant's suggestion, and a person's value by its text", () => {
    const w = mountPanel([
      card({
        rows: [row('a', { kind: 'person', text: 'from the engineer' }), row('b', { kind: 'suggestion', text: '2.5 mm' })],
      }),
    ])
    expect(w.find('[data-basis="person"]').text()).toBe('person: from the engineer')
    expect(w.find('[data-basis="suggestion"]').text()).toBe("assistant's suggestion: 2.5 mm")
  })
})

describe('K8: a destructive proposal', () => {
  it('says so in text and labels Accept for the deletion, and Accept emits with the id', async () => {
    const w = mountPanel([card({ destructive: true })])
    expect(w.text()).toContain('Accepting this proposal deletes items.')
    expect(buttonByText(w, 'Accept')).toBeUndefined()
    await buttonByText(w, 'Accept deletion')!.trigger('click')
    expect(w.emitted('accept')?.[0]).toEqual(['p1'])
  })

  it('leaves the Accept label and the text out of a proposal that does not delete', () => {
    const w = mountPanel([card({ destructive: false })])
    expect(w.text()).not.toContain('deletes items')
    expect(buttonByText(w, 'Accept')).toBeDefined()
  })
})

describe('K8: the later action', () => {
  it('offers Accept on a superseded card and emits accept with its id', async () => {
    const w = mountPanel([card({ id: 'p2', status: 'superseded', later: 'accept' })])
    await buttonByText(w, 'Accept')!.trigger('click')
    expect(w.emitted('accept')?.[0]).toEqual(['p2'])
    expect(buttonByText(w, 'Discard')).toBeUndefined()
  })

  it('offers Load again on an accepted card and emits load-again with its id', async () => {
    const w = mountPanel([card({ id: 'p3', status: 'accepted', later: 'load-again' })])
    await buttonByText(w, 'Load again')!.trigger('click')
    expect(w.emitted('load-again')?.[0]).toEqual(['p3'])
  })

  it('shows neither action on a card that has no later action', () => {
    const w = mountPanel([card({ status: 'superseded', later: null })])
    expect(buttonByText(w, 'Accept')).toBeUndefined()
    expect(buttonByText(w, 'Load again')).toBeUndefined()
  })
})

describe('K8: the chips a reply draws', () => {
  const reply = (text: string): ChatEntry => ({ role: 'agent', text })

  it('draws a string verdict with no unit, and names it in the accessible name', () => {
    const w = mountPanel([reply('Member {{v1:members[e1].status}} holds.')], { refScopes: SECOND_SCOPES })
    const chipEl = w.find('button.aether-chat-chip')
    expect(chipEl.text()).toContain('OK')
    expect(chipEl.attributes('aria-label')).toContain('OK')
    expect(chipEl.find('.aether-chat-chip__quantity').text()).toBe('OK')
  })

  it('draws a mark after the value, and names it', () => {
    const w = mountPanel([reply('Utilisation {{r1:summary.utilisation}}.')])
    expect(w.find('button.aether-chat-chip').attributes('aria-label')).toContain('(lower bound)')
  })

  it('draws no chip for a scope the panel was not given: the text stays plain', () => {
    const w = mountPanel([reply('Member {{v1:members[e1].status}} holds.')])
    expect(w.findAll('button.aether-chat-chip')).toHaveLength(0)
    expect(w.text()).toContain('{{v1:members[e1].status}}')
  })
})
