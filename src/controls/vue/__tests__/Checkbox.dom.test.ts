import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import Checkbox from '../Checkbox.vue'
import CheckboxExample from '../../../gallery/examples/CheckboxExample.vue'
import { declared, stylesOf } from '../../../__tests__/sfcRules'

/* What a screen reader is told and what the eye is shown, read off one element. Any row that is not as
 * it should be comes back named, so a broken element fails with the reason, and the seeded cases below
 * show the reader can see each way of being broken. */
type Expected = 'off' | 'on' | 'mixed'
function misread(el: Element, expected: Expected): string[] {
  const aria = { off: 'false', on: 'true', mixed: 'mixed' }[expected]
  const out: string[] = []
  if (el.tagName !== 'BUTTON') out.push(`element is ${el.tagName}`)
  if (el.getAttribute('role') !== 'checkbox') out.push(`role is ${el.getAttribute('role')}`)
  if (el.getAttribute('aria-checked') !== aria) out.push(`aria-checked is ${el.getAttribute('aria-checked')}, not ${aria}`)
  if (!el.classList.contains(`aether-checkbox--${expected}`)) out.push(`not drawn ${expected}`)
  for (const other of ['off', 'on', 'mixed'].filter((s) => s !== expected)) {
    if (el.classList.contains(`aether-checkbox--${other}`)) out.push(`also drawn ${other}`)
  }
  return out
}

const cases: [Expected, { modelValue: boolean; mixed?: boolean }][] = [
  ['off', { modelValue: false }],
  ['on', { modelValue: true }],
  ['mixed', { modelValue: false, mixed: true }],
  ['mixed', { modelValue: true, mixed: true }],
]

describe('Checkbox tells a screen reader what it draws', () => {
  it.each(cases)('reads %s from %o', (expected, props) => {
    const w = mount(Checkbox, { props: { ...props, label: 'Row' } })
    expect(misread(w.element, expected)).toEqual([])
    w.unmount()
  })

  it('follows its value as the caller changes it', async () => {
    const w = mount(Checkbox, { props: { modelValue: false, label: 'Row' } })
    await w.setProps({ modelValue: true })
    expect(misread(w.element, 'on')).toEqual([])
    await w.setProps({ mixed: true })
    expect(misread(w.element, 'mixed')).toEqual([])
    await w.setProps({ mixed: false, modelValue: false })
    expect(misread(w.element, 'off')).toEqual([])
    w.unmount()
  })

  describe('and the reader above sees a broken one', () => {
    /* A check nobody has seen fail is a check nobody knows works. Each seed takes a real, correct element
     * and breaks one thing; the precondition proves it read clean before the break. */
    const seeded = (expected: Expected, props: { modelValue: boolean; mixed?: boolean }, breakIt: (el: HTMLElement) => void) => {
      const w = mount(Checkbox, { props: { ...props, label: 'Row' } })
      expect(misread(w.element, expected), 'precondition: it read clean before the break').toEqual([])
      breakIt(w.element as HTMLElement)
      const found = misread(w.element, expected)
      w.unmount()
      return found
    }

    it('an on key that tells the reader it is off', () => {
      expect(seeded('on', { modelValue: true }, (el) => el.setAttribute('aria-checked', 'false'))).toEqual([
        'aria-checked is false, not true',
      ])
    })

    it('a mixed key that tells the reader it is on', () => {
      expect(seeded('mixed', { modelValue: false, mixed: true }, (el) => el.setAttribute('aria-checked', 'true'))).toEqual([
        'aria-checked is true, not mixed',
      ])
    })

    it('a key with no state at all', () => {
      expect(seeded('off', { modelValue: false }, (el) => el.removeAttribute('aria-checked'))).toEqual([
        'aria-checked is null, not false',
      ])
    })

    it('a key that lost its role', () => {
      expect(seeded('off', { modelValue: false }, (el) => el.removeAttribute('role'))).toEqual(['role is null'])
    })

    it('a key drawn in the wrong state', () => {
      expect(
        seeded('off', { modelValue: false }, (el) => {
          el.classList.remove('aether-checkbox--off')
          el.classList.add('aether-checkbox--on')
        }),
      ).toEqual(['not drawn off', 'also drawn on'])
    })
  })
})

describe('Checkbox is pressed', () => {
  it('by a click, which asks for the other value', async () => {
    const off = mount(Checkbox, { props: { modelValue: false, label: 'Row' } })
    await off.trigger('click')
    expect(off.emitted('update:modelValue')).toEqual([[true]])
    off.unmount()

    const on = mount(Checkbox, { props: { modelValue: true, label: 'Row' } })
    await on.trigger('click')
    expect(on.emitted('update:modelValue')).toEqual([[false]])
    on.unmount()
  })

  it.each([false, true])('a group partly on, holding %s, asks for all of it on', async (modelValue) => {
    const w = mount(Checkbox, { props: { modelValue, mixed: true, label: 'Row' } })
    await w.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[true]])
    w.unmount()
  })

  it('and does not move until the caller writes the value back', async () => {
    /* A caller that refuses a change must not be left with a key disagreeing with its data. */
    const w = mount(Checkbox, { props: { modelValue: false, label: 'Row' } })
    await w.trigger('click')
    await nextTick()
    expect(w.emitted('update:modelValue')).toEqual([[true]])
    expect(misread(w.element, 'off')).toEqual([])
    w.unmount()
  })

  it('works with v-model, there and back', async () => {
    const on = ref(false)
    const w = mount(Checkbox, {
      props: {
        modelValue: on.value,
        label: 'Row',
        'onUpdate:modelValue': (v: boolean) => {
          on.value = v
          w.setProps({ modelValue: v })
        },
      },
    })
    await w.trigger('click')
    expect(misread(w.element, 'on')).toEqual([])
    await w.trigger('click')
    expect(misread(w.element, 'off')).toEqual([])
    w.unmount()
  })
})

describe('Checkbox from the keyboard', () => {
  const key = (el: Element, type: 'keydown' | 'keyup', k: string, repeat = false) => {
    const e = new KeyboardEvent(type, { key: k, repeat, bubbles: true, cancelable: true })
    el.dispatchEvent(e)
    return e
  }

  it('Space presses it once, and takes the key so the page does not scroll', () => {
    const w = mount(Checkbox, { props: { modelValue: false, label: 'Row' } })
    const down = key(w.element, 'keydown', ' ')
    expect(down.defaultPrevented).toBe(true)
    expect(w.emitted('update:modelValue')).toEqual([[true]])
    w.unmount()
  })

  it('stops the click a browser adds as Space comes up, so one press is not two', () => {
    const w = mount(Checkbox, { props: { modelValue: false, label: 'Row' } })
    expect(key(w.element, 'keyup', ' ').defaultPrevented).toBe(true)
    w.unmount()
  })

  it('a key held down presses once', () => {
    const w = mount(Checkbox, { props: { modelValue: false, label: 'Row' } })
    key(w.element, 'keydown', ' ')
    const held = key(w.element, 'keydown', ' ', true)
    expect(held.defaultPrevented, 'precondition: the held key is still taken').toBe(true)
    expect(w.emitted('update:modelValue')).toEqual([[true]])
    w.unmount()
  })

  it('Enter does not press it, and blocks the click a button would make of it', () => {
    const w = mount(Checkbox, { props: { modelValue: false, label: 'Row' } })
    expect(key(w.element, 'keydown', 'Enter').defaultPrevented).toBe(true)
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('leaves every other key alone', () => {
    const w = mount(Checkbox, { props: { modelValue: false, label: 'Row' } })
    for (const k of ['Tab', 'Escape', 'ArrowDown', 'a']) {
      expect(key(w.element, 'keydown', k).defaultPrevented, k).toBe(false)
    }
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('takes focus', () => {
    const w = mount(Checkbox, { props: { modelValue: false, label: 'Row' }, attachTo: document.body })
    ;(w.element as HTMLElement).focus()
    expect(document.activeElement).toBe(w.element)
    w.unmount()
  })
})

describe('Checkbox with something interactive in its label', () => {
  /* A real parent, which writes back what the key asks, so a press shows in its value. */
  function labelled() {
    const on = ref(false)
    const w = mount(
      defineComponent({
        setup: () => () =>
          h(Checkbox, { modelValue: on.value, 'onUpdate:modelValue': (v: boolean) => (on.value = v) }, () => [
            h('span', { id: 'words' }, 'Accept '),
            h('a', { id: 'link', href: '#terms' }, 'the terms'),
            h('input', { id: 'field', type: 'text' }),
            h('button', { id: 'button', type: 'button' }, 'More'),
          ]),
      }),
      { attachTo: document.body },
    )
    const part = (id: string) => w.get(`#${id}`).element as HTMLElement
    const key = (el: Element, type: 'keydown' | 'keyup', k: string) => {
      const e = new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true })
      el.dispatchEvent(e)
      return e
    }
    return { w, on, part, key }
  }

  it('leaves Space to an input there, which types it, and the key stays as it is', async () => {
    const { w, on, part, key } = labelled()
    expect(key(part('field'), 'keydown', ' ').defaultPrevented).toBe(false)
    await nextTick()
    expect(on.value).toBe(false)
    w.unmount()
  })

  it('leaves Enter to a link there, which follows it', async () => {
    const { w, on, part, key } = labelled()
    expect(key(part('link'), 'keydown', 'Enter').defaultPrevented).toBe(false)
    await nextTick()
    expect(on.value).toBe(false)
    w.unmount()
  })

  it('leaves the click on Space coming up to a button there', () => {
    const { w, part, key } = labelled()
    expect(key(part('button'), 'keyup', ' ').defaultPrevented).toBe(false)
    w.unmount()
  })

  it.each(['link', 'field', 'button'])('takes no press from a click on the %s there', async (id) => {
    const { w, on, part } = labelled()
    part(id).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(on.value).toBe(false)
    w.unmount()
  })

  it('still presses from a click on the plain words, and from Space and a click on the key itself', async () => {
    const { w, on, part, key } = labelled()
    part('words').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(on.value, 'the plain words').toBe(true)
    const button = w.get('button[role="checkbox"]').element
    expect(key(button, 'keydown', ' ').defaultPrevented, 'Space is taken').toBe(true)
    await nextTick()
    expect(on.value, 'Space').toBe(false)
    expect(key(button, 'keyup', ' ').defaultPrevented, 'the click on the way up is stopped').toBe(true)
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(on.value, 'a click').toBe(true)
    w.unmount()
  })
})

describe('Checkbox while disabled', () => {
  it.each(cases)('%s reads disabled, and still reads its state', (expected, props) => {
    const w = mount(Checkbox, { props: { ...props, disabled: true, label: 'Row' } })
    expect(w.attributes('disabled')).toBeDefined()
    expect(misread(w.element, expected)).toEqual([])
    w.unmount()
  })

  it('gives nothing to a click', () => {
    const w = mount(Checkbox, { props: { modelValue: false, disabled: true, label: 'Row' } })
    // Past the browser's own guard on a disabled button, to reach the component's.
    w.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('gives nothing to Space', () => {
    const w = mount(Checkbox, { props: { modelValue: false, disabled: true, label: 'Row' } })
    w.element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })
})

describe('Checkbox is named', () => {
  it('by its slot, which sits inside the button so a press on the words presses it', async () => {
    const w = mount(Checkbox, { props: { modelValue: false, label: 'Unused' }, slots: { default: 'Rivers' } })
    expect(w.text()).toBe('Rivers')
    expect(w.attributes('aria-label')).toBeUndefined()
    await w.get('.aether-checkbox__label').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[true]])
    w.unmount()
  })

  it('by `label` with no slot', () => {
    const w = mount(Checkbox, { props: { modelValue: false, label: 'Rivers' } })
    expect(w.attributes('aria-label')).toBe('Rivers')
    expect(w.find('.aether-checkbox__label').exists()).toBe(false)
    w.unmount()
  })

  it('or by what the caller passes, which reaches the button', () => {
    const w = mount(Checkbox, {
      props: { modelValue: false },
      attrs: { id: 'rivers', 'aria-labelledby': 'rivers-name' },
    })
    expect(w.attributes('id')).toBe('rivers')
    expect(w.attributes('aria-labelledby')).toBe('rivers-name')
    w.unmount()
  })

  it('and its drawing is hidden from a reader', () => {
    const w = mount(Checkbox, { props: { modelValue: true, label: 'Rivers' } })
    expect(w.get('.aether-checkbox__key').attributes('aria-hidden')).toBe('true')
    w.unmount()
  })
})

describe('Checkbox is sized', () => {
  const side = (props: Record<string, unknown>) => {
    const w = mount(Checkbox, { props: { modelValue: false, label: 'Row', ...props } })
    const out = (w.element as HTMLElement).style.getPropertyValue('--side')
    w.unmount()
    return out
  }

  it('at 16px unless the caller says otherwise', () => {
    expect(side({})).toBe('16px')
    expect(side({ size: 24 })).toBe('24px')
  })
})

describe('Checkbox’s own rules', () => {
  /* The suite's jsdom gets no component CSS, so what the eye is given has no failing test unless one
   * reads the rule. */
  const sheet = stylesOf('controls/vue/Checkbox.vue')
  const on = '.aether-checkbox--on .aether-checkbox__key'
  const mixed = '.aether-checkbox--mixed .aether-checkbox__key'

  it('lights from the two mark tokens, with no colour of its own', () => {
    const fill = declared(sheet, on)['background'] ?? declared(sheet, on)['background-image']
    expect(fill).toContain('var(--aether-mark-warm)')
    expect(fill).toContain('var(--aether-mark-cool)')
    expect(fill).not.toMatch(/#[0-9a-f]{3,8}/i)
  })

  it('dims partly on from the same two tokens, each by the same mix with the ground', () => {
    const fill = declared(sheet, mixed)['background'] ?? declared(sheet, mixed)['background-image']
    expect(fill).toContain('color-mix(in srgb, var(--aether-mark-warm) 62%, var(--aether-surface))')
    expect(fill).toContain('color-mix(in srgb, var(--aether-mark-cool) 62%, var(--aether-surface))')
  })

  it('draws off as a well, and neither of the other states as one', () => {
    const well = declared(sheet, '.aether-checkbox__key')
    expect(well['box-shadow']).toContain('inset')
    expect(well['background'] ?? well['background-color']).not.toContain('--aether-mark')
    expect(declared(sheet, on)['box-shadow']).not.toBe(well['box-shadow'])
    expect(declared(sheet, mixed)['box-shadow']).not.toBe(well['box-shadow'])
  })

  it('shows the dot only when on, and the bar only when partly on', () => {
    expect(declared(sheet, '.aether-checkbox__glyph')['transform']).toBe('scale(0)')
    expect(declared(sheet, '.aether-checkbox--on .aether-checkbox__glyph')['transform']).toBe('scale(1)')
    const bar = declared(sheet, '.aether-checkbox--mixed .aether-checkbox__glyph')
    expect(bar['transform']).toBe('scale(1)')
    expect(bar['width']).toBe('var(--bar-width)')
    expect(bar['height']).toBe('var(--bar-height)')
  })

  it('states its own box model, since the kit ships no reset', () => {
    const rule = declared(sheet, '.aether-checkbox')
    expect(rule['box-sizing']).toBe('border-box')
    expect(rule['padding-top'] ?? rule['padding']).toBeDefined()
    expect(declared(sheet, '.aether-checkbox__key')['box-sizing']).toBe('border-box')
  })

  it('draws the kit’s ring on the key when focused from the keyboard', () => {
    const ring = declared(sheet, '.aether-checkbox:focus-visible .aether-checkbox__key')
    expect(ring['outline-width'] ?? ring['outline']).toBeDefined()
    expect(JSON.stringify(ring)).toContain('var(--aether-cool)')
  })

  it('reads disabled to the eye', () => {
    expect(declared(sheet, '.aether-checkbox:disabled')['opacity']).toBe('0.55')
  })

  it('grows its target under a coarse pointer, and leaves the key alone', () => {
    const coarse = declared(sheet, '.aether-checkbox', '(pointer: coarse)')
    expect(coarse['min-height']).toBe('var(--aether-touch-dense)')
    expect(coarse['min-width']).toBe('var(--aether-touch-dense)')
  })

  it('stops its movement for a reader who asked', () => {
    const still = declared(sheet, '.aether-checkbox__key', '(prefers-reduced-motion: reduce)')
    expect(JSON.stringify(still)).toContain('none')
  })

  it('draws its states again in a forced palette', () => {
    const off = declared(sheet, '.aether-checkbox__key', '(forced-colors: active)')
    expect(off['forced-color-adjust']).toBe('none')
    const lit = declared(sheet, on, '(forced-colors: active)')
    expect(lit['background'] ?? lit['background-color']).toBe('highlight')
  })
})

describe('Checkbox on the site', () => {
  it('turns a group from its rows, and its rows from the group', async () => {
    const w = mount(CheckboxExample)
    const group = () => w.findAllComponents(Checkbox)[0]!
    expect(misread(group().element, 'mixed'), 'two of three rows start on').toEqual([])
    await group().trigger('click')
    expect(misread(group().element, 'on')).toEqual([])
    expect(w.find('.g-ex-state').text()).toBe('3 of 3 on')
    await group().trigger('click')
    expect(misread(group().element, 'off')).toEqual([])
    expect(w.find('.g-ex-state').text()).toBe('0 of 3 on')
    await w.findAllComponents(Checkbox)[1]!.trigger('click')
    expect(misread(group().element, 'mixed')).toEqual([])
    w.unmount()
  })

  it('keeps its disabled row where it is', async () => {
    const w = mount(CheckboxExample)
    const locked = w.findAllComponents(Checkbox).find((c) => c.text().startsWith('Boundaries'))!
    expect(locked.attributes('disabled')).toBeDefined()
    expect(misread(locked.element, 'on')).toEqual([])
    w.unmount()
  })
})
