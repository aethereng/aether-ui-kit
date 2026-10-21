import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ChatPanel from '../ChatPanel.vue'
import type { ChatEntry, ChatProposalBasis, ChatProposalMessage, ChatProposalRow, RefChipData } from '../../core'

/* The proposal card's basis column, its destructive wording and its later action, and the chips a
 * reply draws with the scope list the panel is given. The relay contract is in ChatPanel.dom.test.ts,
 * and the assistant's own rendering is in ChatPanel.assistant.dom.test.ts. */

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

describe('the proposal basis column', () => {
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
    expect(w.find('[data-basis="person"]').text()).toBe('your words: from the engineer')
    expect(w.find('[data-basis="suggestion"]').text()).toBe("assistant's suggestion: 2.5 mm")
  })

  it('shows a basis with no text as its label alone, with no colon after it', () => {
    const w = mountPanel([card({ rows: [row('a', { kind: 'person', text: '' })] })])
    expect(w.find('[data-basis="person"]').text()).toBe('your words')
  })
})

describe('a destructive proposal', () => {
  it('says so in text and labels Accept for the deletion, and Accept emits with the id', async () => {
    const w = mountPanel([card({ destructive: true })])
    expect(w.text()).toContain('Accepting this proposal deletes items.')
    expect(buttonByText(w, 'Accept')).toBeUndefined()
    await buttonByText(w, 'Accept and delete')!.trigger('click')
    expect(w.emitted('accept')?.[0]).toEqual(['p1', { rows: [0], note: '' }])
  })

  it('leaves the Accept label and the text out of a proposal that does not delete', () => {
    const w = mountPanel([card({ destructive: false })])
    expect(w.text()).not.toContain('deletes items')
    expect(buttonByText(w, 'Accept')).toBeDefined()
  })
})

describe('the later action', () => {
  it('offers Accept on a superseded card and emits accept with its id', async () => {
    const w = mountPanel([card({ id: 'p2', status: 'superseded', later: 'accept' })])
    await buttonByText(w, 'Accept')!.trigger('click')
    expect(w.emitted('accept')?.[0]).toEqual(['p2', { rows: [0], note: '' }])
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

describe('the chips a reply draws', () => {
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

describe('a proposal card that asks for selection', () => {
  const sel = (path: string): ChatProposalRow => ({ ...row(path), selectable: true })
  const ticks = (w: VueWrapper) => w.findAll('input[type="checkbox"]')
  const controlsOf = (w: VueWrapper) => w.findAll('.aether-chat__proposal-actions button').map((b) => b.text())

  it('draws a tick on each selectable row, on by default, named for a screen reader', () => {
    const w = mountPanel([card({ rows: [sel('a'), row('b'), sel('c')] })])
    expect(ticks(w)).toHaveLength(2)
    expect(ticks(w).map((t) => (t.element as HTMLInputElement).checked)).toEqual([true, true])
    expect(ticks(w).map((t) => t.attributes('aria-label'))).toEqual(['take a', 'take c'])
  })

  it('negative arm: a card with no selectable row draws no tick and no take column', () => {
    const w = mountPanel([card({ rows: [row('a'), row('b')] })])
    expect(ticks(w)).toHaveLength(0)
    expect(w.findAll('th').map((t) => t.text())).not.toContain('take')
  })

  it('offers Accept, Accept all and Discard all; a card with no selection keeps Accept and Discard', () => {
    expect(controlsOf(mountPanel([card({ rows: [sel('a')] })]))).toEqual(['Accept', 'Accept all', 'Discard all'])
    expect(controlsOf(mountPanel([card({ rows: [row('a')] })]))).toEqual(['Accept', 'Discard'])
  })

  it('labels the destructive forms of the selection actions as deletions', () => {
    const w = mountPanel([card({ destructive: true, rows: [sel('a')] })])
    expect(controlsOf(w)).toEqual(['Accept and delete', 'Accept all and delete', 'Discard all'])
  })

  it('Accept emits the ticked rows and the note; an unticked selectable row is left out', async () => {
    const w = mountPanel([card({ note: true, rows: [sel('a'), sel('b'), row('c')] })])
    await ticks(w)[0]!.setValue(false)
    await w.get('.aether-chat__proposal-note textarea').setValue('keep the second')
    await buttonByText(w, 'Accept')!.trigger('click')
    expect(w.emitted('accept')?.[0]).toEqual(['p1', { rows: [1, 2], note: 'keep the second' }])
  })

  it('Accept all emits every row, ticked or not', async () => {
    const w = mountPanel([card({ rows: [sel('a'), sel('b')] })])
    await ticks(w)[0]!.setValue(false)
    await buttonByText(w, 'Accept all')!.trigger('click')
    expect(w.emitted('accept-all')?.[0]).toEqual(['p1', { rows: [0, 1], note: '' }])
  })

  it('Discard all emits discard with no rows taken', async () => {
    const w = mountPanel([card({ note: true, rows: [sel('a')] })])
    await w.get('.aether-chat__proposal-note textarea').setValue('not this one')
    await buttonByText(w, 'Discard all')!.trigger('click')
    expect(w.emitted('discard')?.[0]).toEqual(['p1', { rows: [], note: 'not this one' }])
  })

  it('negative arm: Accept is disabled when no row would be taken', async () => {
    const w = mountPanel([card({ rows: [sel('a')] })])
    await ticks(w)[0]!.setValue(false)
    expect(buttonByText(w, 'Accept')!.attributes('disabled')).toBeDefined()
  })

  it('draws the note field only on a card that asks for one', () => {
    expect(mountPanel([card({ note: true })]).find('.aether-chat__proposal-note textarea').exists()).toBe(true)
    wrapper?.unmount()
    expect(mountPanel([card({})]).find('.aether-chat__proposal-note textarea').exists()).toBe(false)
  })

  it('takes the ticks and the note off a card that has left pending, and leaves them live while pending', async () => {
    const rows = [sel('a'), row('b'), sel('c')]
    const w = mountPanel([card({ note: true, rows })])
    expect(ticks(w).map((t) => (t.element as HTMLInputElement).disabled)).toEqual([false, false])
    expect(w.get('.aether-chat__proposal-note textarea').attributes('disabled')).toBeUndefined()
    await w.setProps({ messages: [card({ note: true, rows, status: 'superseded', later: 'accept' })] })
    expect(ticks(w).map((t) => (t.element as HTMLInputElement).disabled)).toEqual([true, true])
    expect(w.get('.aether-chat__proposal-note textarea').attributes('disabled')).toBeDefined()
  })

  it.each(['superseded', 'discarded'] as const)(
    'guards the later Accept of a %s card: disabled when no row is left ticked, and emits nothing',
    async (status) => {
      const rows = [sel('a'), sel('b')]
      const w = mountPanel([card({ rows })])
      await ticks(w)[0]!.setValue(false)
      await ticks(w)[1]!.setValue(false)
      await w.setProps({ messages: [card({ status, later: 'accept', rows })] })
      expect(buttonByText(w, 'Accept')!.attributes('disabled')).toBeDefined()
      await buttonByText(w, 'Accept')!.trigger('click')
      expect(w.emitted('accept')).toBeUndefined()
    },
  )

  it('positive arm: a later Accept with one row still ticked is enabled and emits that row', async () => {
    const rows = [sel('a'), sel('b')]
    const w = mountPanel([card({ rows })])
    await ticks(w)[0]!.setValue(false)
    await w.setProps({ messages: [card({ status: 'superseded', later: 'accept', rows })] })
    expect(buttonByText(w, 'Accept')!.attributes('disabled')).toBeUndefined()
    await buttonByText(w, 'Accept')!.trigger('click')
    expect(w.emitted('accept')?.[0]).toEqual(['p1', { rows: [1], note: '' }])
  })
})

describe('the cells of a proposal row', () => {
  const reply = { text: 'x {{v1:members[e1].status}} y', marks: [{ start: 0, end: 1, kind: 'changed' }] }

  it('draws a cell object as a reply draws its text: marks highlighted and references as chips', () => {
    const w = mountPanel([card({ rows: [{ path: 'a', before: reply, after: '2' }] })], { refScopes: SECOND_SCOPES })
    const before = w.get('del.aether-chat__before')
    expect(before.get('.aether-chat__mark').attributes('title')).toBe('changed')
    expect(before.get('button.aether-chat-chip').text()).toContain('OK')
  })

  it('negative arm: a plain string cell is text, so a reference in it is not a chip', () => {
    const w = mountPanel([card({ rows: [{ path: 'a', before: '{{v1:members[e1].status}}', after: '2' }] })], {
      refScopes: SECOND_SCOPES,
    })
    expect(w.get('del.aether-chat__before').text()).toBe('{{v1:members[e1].status}}')
    expect(w.find('del.aether-chat__before button').exists()).toBe(false)
  })
})
