import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Dialog from '../Dialog.vue'
import Tooltip from '../Tooltip.vue'
import Menu from '../Menu.vue'
import type { MenuItem } from '../../core/menu'

/* Grouped on purpose: what these three share is not markup, it is a dependency on platform APIs
 * that DO NOT EXIST HERE. jsdom implements neither the popover API nor dialog.showModal, and
 * CSS.supports('position-anchor') is false — so this file runs every one of them down its degraded
 * path, which is the path a consumer's own test suite will take too.
 *
 * That makes the first describe the important one. Written unguarded, all three threw on mount and
 * would have broken any downstream test that rendered them. The rest of the behaviour is asserted
 * here; the top-layer and anchor-positioning behaviour is verified in a real browser instead,
 * because asserting it in jsdom would be asserting a shim. */

const items: MenuItem[] = [
  { id: 'new', label: 'New model' },
  { id: 'sep', label: '', separator: true },
  { id: 'save', label: 'Save' },
  { id: 'saveas', label: 'Save as…', disabled: true },
]

beforeEach(() => {
  document.body.style.overflow = ''
})

describe('the overlays degrade instead of throwing where the platform APIs are absent', () => {
  it('confirms the environment really is missing them', () => {
    // If this ever fails, jsdom gained support and the tests below stop proving what they claim.
    expect('popover' in document.createElement('div')).toBe(false)
    expect(typeof document.createElement('dialog').showModal).toBe('undefined')
  })

  it('Dialog opens without showModal', () => {
    const w = mount(Dialog, { props: { open: true, title: 'Section' }, attachTo: document.body })
    expect(w.get('dialog').attributes('open')).toBeDefined()
    w.unmount()
  })

  it('Tooltip shows without showPopover', async () => {
    const w = mount(Tooltip, {
      props: { text: 'Suppress this coupling', delay: 0 },
      slots: { default: '<button aria-label="Suppress">x</button>' },
      attachTo: document.body,
    })
    await w.get('span').trigger('focusin')
    // Visibility falls to the class, since the popover attribute is inert here.
    expect(w.get('[role="tooltip"]').classes()).toContain('is-open')
    w.unmount()
  })

  it('Menu opens without showPopover', async () => {
    const w = mount(Menu, { props: { items }, attachTo: document.body })
    await w.get('button.aether-menu__trigger').trigger('click')
    expect(w.get('[role="menu"]').classes()).toContain('is-open')
    w.unmount()
  })
})

describe('Dialog', () => {
  it('emits update:open when the element closes itself', () => {
    const w = mount(Dialog, { props: { open: true }, attachTo: document.body })
    w.get('dialog').element.dispatchEvent(new Event('close'))
    expect(w.emitted('update:open')?.[0]).toEqual([false])
    w.unmount()
  })

  it('locks page scroll while open and restores what was there before', () => {
    /* Restores the PREVIOUS value rather than clearing: a host that already had overflow set on
     * body would otherwise have it silently wiped by opening a dialog. */
    document.body.style.overflow = 'clip'
    const w = mount(Dialog, { props: { open: true }, attachTo: document.body })
    expect(document.body.style.overflow).toBe('hidden')
    w.unmount()
    expect(document.body.style.overflow).toBe('clip')
  })

  it('releases the scroll lock when the OPEN PROP goes false', async () => {
    /* The regression this exists for. Cleanup originally hung off the `close` event — and measured
     * in Chrome 148, showModal() followed by close() fires no `close` event at all, so the lock
     * was never released and the page stayed unscrollable with no dialog on screen to explain it.
     * Release now happens on the path the component controls. */
    const w = mount(Dialog, { props: { open: true }, attachTo: document.body })
    expect(document.body.style.overflow).toBe('hidden')
    await w.setProps({ open: false })
    expect(document.body.style.overflow).toBe('')
    w.unmount()
  })

  it('releases the scroll lock even when unmounted while still open', () => {
    // Otherwise the page is left permanently unscrollable with no dialog on screen to explain it.
    const w = mount(Dialog, { props: { open: true }, attachTo: document.body })
    expect(document.body.style.overflow).toBe('hidden')
    w.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('omits the close button when it is not dismissible', () => {
    const w = mount(Dialog, { props: { open: true, dismissible: false }, attachTo: document.body })
    expect(w.find('.aether-dialog__x').exists()).toBe(false)
    w.unmount()
  })

  it('prevents Escape from closing a non-dismissible dialog', () => {
    const w = mount(Dialog, { props: { open: true, dismissible: false }, attachTo: document.body })
    const e = new Event('cancel', { cancelable: true })
    w.get('dialog').element.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    w.unmount()
  })
})

describe('Tooltip — the description it does and does not add', () => {
  it('describes the trigger when the tooltip says something new', async () => {
    const w = mount(Tooltip, {
      props: { text: 'Suppress this coupling (undoable)' },
      slots: { default: '<button aria-label="Suppress">x</button>' },
      attachTo: document.body,
    })
    await w.vm.$nextTick()
    const btn = w.get('button')
    expect(btn.attributes('aria-describedby')).toBe(w.get('[role="tooltip"]').attributes('id'))
    w.unmount()
  })

  it('does NOT describe the trigger when it only restates the accessible name', async () => {
    /* THE case, and half the real call sites: a tooltip reading "Fit view" on a button already
     * labelled "Fit view". Wired up, a screen reader announces the same words twice. */
    const w = mount(Tooltip, {
      props: { text: 'Fit view' },
      slots: { default: '<button aria-label="Fit view">⤢</button>' },
      attachTo: document.body,
    })
    await w.vm.$nextTick()
    expect(w.get('button').attributes('aria-describedby')).toBeUndefined()
    w.unmount()
  })

  it('ignores case and surrounding space when deciding that', async () => {
    const w = mount(Tooltip, {
      props: { text: '  fit view ' },
      slots: { default: '<button aria-label="Fit view">⤢</button>' },
      attachTo: document.body,
    })
    await w.vm.$nextTick()
    expect(w.get('button').attributes('aria-describedby')).toBeUndefined()
    w.unmount()
  })

  it('stays shut when disabled', async () => {
    const w = mount(Tooltip, {
      props: { text: 'Nope', disabled: true, delay: 0 },
      slots: { default: '<button>x</button>' },
      attachTo: document.body,
    })
    await w.get('span').trigger('focusin')
    expect(w.get('[role="tooltip"]').classes()).not.toContain('is-open')
    w.unmount()
  })
})

describe('Menu', () => {
  it('wires the trigger the way a menu button is expected to be', async () => {
    const w = mount(Menu, { props: { items }, attachTo: document.body })
    const t = w.get('button.aether-menu__trigger')
    expect(t.attributes('aria-haspopup')).toBe('menu')
    expect(t.attributes('aria-expanded')).toBe('false')
    await t.trigger('click')
    expect(w.get('button.aether-menu__trigger').attributes('aria-expanded')).toBe('true')
    w.unmount()
  })

  it('renders separators as separators, not as menu items', async () => {
    const w = mount(Menu, { props: { items }, attachTo: document.body })
    await w.get('button.aether-menu__trigger').trigger('click')
    expect(w.findAll('[role="menuitem"]')).toHaveLength(3)
    expect(w.findAll('[role="separator"]')).toHaveLength(1)
    w.unmount()
  })

  it('disables the disabled item rather than only styling it', async () => {
    const w = mount(Menu, { props: { items }, attachTo: document.body })
    await w.get('button.aether-menu__trigger').trigger('click')
    const saveas = w.findAll('[role="menuitem"]').find((b) => b.text().startsWith('Save as'))!
    expect(saveas.attributes('disabled')).toBeDefined()
    w.unmount()
  })

  it('emits the id and closes on select', async () => {
    const w = mount(Menu, { props: { items }, attachTo: document.body })
    await w.get('button.aether-menu__trigger').trigger('click')
    const save = w.findAll('[role="menuitem"]').find((b) => b.text() === 'Save')!
    await save.trigger('click')
    expect(w.emitted('select')?.[0]).toEqual(['save'])
    expect(w.get('button.aether-menu__trigger').attributes('aria-expanded')).toBe('false')
    w.unmount()
  })

  it('moves the roving tabindex with the keyboard, skipping what cannot be reached', async () => {
    const w = mount(Menu, { props: { items }, attachTo: document.body })
    await w.get('button.aether-menu__trigger').trigger('keydown', { key: 'ArrowDown' })
    const tabbable = () =>
      w.findAll('[role="menuitem"]').filter((b) => b.attributes('tabindex') === '0')
    expect(tabbable()).toHaveLength(1)
    expect(tabbable()[0]!.text()).toBe('New model')

    await w.get('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    expect(tabbable()[0]!.text()).toBe('Save')

    // Past the disabled 'Save as…' and round to the top, never onto it.
    await w.get('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    expect(tabbable()[0]!.text()).toBe('New model')
    w.unmount()
  })

  it('closes on Escape', async () => {
    const w = mount(Menu, { props: { items }, attachTo: document.body })
    await w.get('button.aether-menu__trigger').trigger('click')
    await w.get('[role="menu"]').trigger('keydown', { key: 'Escape' })
    expect(w.get('button.aether-menu__trigger').attributes('aria-expanded')).toBe('false')
    w.unmount()
  })
})
