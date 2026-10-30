import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ChatPanel from '../ChatPanel.vue'
import type { ChatEntry, RefChipData } from '../../core'

/* The chips a reply draws with the scope list the panel is given. */

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
      rich: true,
      resolveRef: (ref: string) => RESOLVE[ref] ?? null,
      ...extra,
    },
  })
  return wrapper
}

describe('the chips a reply draws', () => {
  const reply = (text: string): ChatEntry => ({ role: 'reply', text })

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
