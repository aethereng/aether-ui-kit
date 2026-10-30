import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useDismiss } from '../composables'

/* The Vue form of bindDismiss: what it reads from its refs, and that it lets go of the window with
 * the component. The rules themselves are tested in controls/core. */

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useDismiss', () => {
  const open = ref(false)
  const Popover = defineComponent({
    props: { first: { type: Boolean, default: undefined } },
    setup(props) {
      const root = ref<HTMLElement | null>(null)
      const control = ref<HTMLElement | null>(null)
      useDismiss(open, root, () => control.value, props.first === undefined ? undefined : { first: props.first })
      return () =>
        h('div', [
          h('div', { ref: root }, [
            h('button', { ref: control, id: 'control' }, 'Open'),
            open.value ? h('div', { id: 'panel' }, [h('button', { id: 'in' }, 'In')]) : null,
          ]),
          h('button', { id: 'out' }, 'Out'),
        ])
    },
  })

  it('closes on Escape, handing focus to the control, and on a press outside', async () => {
    open.value = true
    const w = mount(Popover, { attachTo: document.body })
    const inside = w.get('#in').element as HTMLElement
    inside.focus()
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    inside.dispatchEvent(e)
    await nextTick()
    expect(open.value).toBe(false)
    expect(document.activeElement).toBe(w.get('#control').element)
    expect(e.defaultPrevented).toBe(true)

    open.value = true
    await nextTick()
    w.get('#in').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(open.value).toBe(true)
    w.get('#out').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(open.value).toBe(false)
    w.unmount()
  })

  it('passes its options to the core: first false leaves Escape unmarked', async () => {
    open.value = true
    const w = mount(Popover, { props: { first: false }, attachTo: document.body })
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    w.get('#in').element.dispatchEvent(e)
    expect(open.value).toBe(false)
    expect(e.defaultPrevented).toBe(false)
    w.unmount()
  })

  it('lets go of the window with the component', async () => {
    open.value = true
    const w = mount(Popover, { attachTo: document.body })
    w.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(open.value).toBe(true)
  })
})
