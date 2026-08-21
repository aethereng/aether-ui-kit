import { beforeAll, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import TextField from '../TextField.vue'
import NumberField from '../NumberField.vue'
import Select from '../Select.vue'
import SearchField from '../SearchField.vue'
import type { SelectGroup, SelectOption } from '../../core/types'

/* The v0.13.0 extractions gained standalone components and no standalone tests: the suite reached
 * them only through PropertyEditor, by native selectors, so nothing pinned their own contracts.
 * What is tested here is what each one PROMISES that a plain input does not. */

describe('TextField', () => {
  it('commits every keystroke — that is the whole difference from NumberField', async () => {
    const w = mount(TextField, { props: { modelValue: '' } })
    const el = w.get('input')
    ;(el.element as HTMLInputElement).value = 'Bea'
    await el.trigger('input')
    expect(w.emitted('update:modelValue')![0]).toEqual(['Bea'])
    w.unmount()
  })

  it('is a textarea when multiline, and an input otherwise — a prop, not a component', () => {
    const single = mount(TextField, { props: { modelValue: 'x' } })
    expect(single.element.tagName).toBe('INPUT')
    single.unmount()

    const multi = mount(TextField, { props: { modelValue: 'x', multiline: true, rows: 4 } })
    expect(multi.element.tagName).toBe('TEXTAREA')
    expect(multi.attributes('rows')).toBe('4')
    multi.unmount()
  })

  it('ignores rows when it is not multiline', () => {
    const w = mount(TextField, { props: { modelValue: 'x', rows: 9 } })
    expect(w.attributes('rows')).toBeUndefined()
    w.unmount()
  })

  it('is a single root element, so id and aria-label reach the control', () => {
    const w = mount(TextField, {
      props: { modelValue: '' },
      attrs: { id: 'note', 'aria-label': 'Note' },
    })
    expect(w.attributes('id')).toBe('note')
    expect(w.attributes('aria-label')).toBe('Note')
    w.unmount()
  })

  describe('autogrow', () => {
    // jsdom never lays out scrollable content -- scrollHeight is always 0 -- so every test
    // below stubs it to a value that would be visibly wrong if grow() were never called (or
    // called against stale state). Same technique as ChatPanel.dom.test.ts's auto-scroll test.
    beforeAll(() => {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        get() { return 480 },
      })
      // getComputedStyle().lineHeight has the same problem as border-width above (jsdom applies
      // no SFC style, so this component's real `line-height: 1.5` is invisible here) — but
      // unlike border-width, the maxRows math NEEDS a real number to multiply: 'normal' isn't
      // one, and parseFloat('normal') is NaN, which poisons the whole calculation silently
      // (el.style.height = 'NaNpx' is an invalid CSS value, so the assignment is just dropped,
      // leaving the 'auto' from grow()'s own reset step sitting there looking like nothing ran).
      // A CSSStyleDeclaration.prototype getter does not reach this: jsdom's getComputedStyle
      // returns an object with its OWN lineHeight property, which shadows the prototype rather
      // than inheriting from it. Wrapping the function itself is what actually reaches every
      // caller, including grow()'s own internal one, not just this file's later assertions.
      const realGCS = window.getComputedStyle.bind(window)
      vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
        const real = realGCS(el, pseudo)
        return new Proxy(real, {
          get(target, prop, receiver) {
            return prop === 'lineHeight' ? '20px' : Reflect.get(target, prop, receiver)
          },
        })
      })
    })

    it('off by default: height is never touched, resize stays the multiline default', () => {
      const w = mount(TextField, { props: { modelValue: 'x'.repeat(500), multiline: true } })
      const el = w.element as HTMLTextAreaElement
      expect(el.style.height).toBe('')
      expect(w.classes()).not.toContain('aether-textfield--autogrow')
      w.unmount()
    })

    it('carries the modifier class, which is what turns resize off and hides the corner glyph', () => {
      const w = mount(TextField, { props: { modelValue: 'x', multiline: true, autogrow: true } })
      expect(w.classes()).toContain('aether-textfield--autogrow')
      w.unmount()
    })

    // jsdom applies none of a Vue SFC's <style> block, scoped or not -- getComputedStyle on any
    // element here reports jsdom's OWN internal defaults, never this component's actual 1px
    // border. That default is real (not NaN, not ''), just not this file's to hardcode: doing
    // so would silently start asserting a jsdom implementation detail instead of the formula
    // grow() actually runs. Read it back and use it, so the expectation is `scrollHeight +
    // whatever this environment's border resolves to`, exactly what the component computes.
    function expectedHeight(el: HTMLTextAreaElement, scrollHeight: number) {
      const cs = getComputedStyle(el)
      return `${scrollHeight + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)}px`
    }

    it('grows to fit content, live, as it is typed', async () => {
      // maxRows: 100 keeps this test testing what it says -- growth tracking -- uninterrupted
      // by the DEFAULT cap, which is dedicated coverage below and would otherwise clamp this
      // long before it demonstrates anything about tracking content.
      const w = mount(TextField, { props: { modelValue: '', multiline: true, autogrow: true, maxRows: 100 } })
      const el = w.element as HTMLTextAreaElement
      el.value = 'a lot more text than three rows holds'
      await w.get('textarea').trigger('input')
      await nextTick() // past the component's own nextTick(grow) inside its modelValue watcher
      expect(el.style.height).toBe(expectedHeight(el, 480)) // 480 is the stubbed scrollHeight
      w.unmount()
    })

    it('re-measures when a caller reassigns modelValue directly — the case this exists for, not just typing', async () => {
      // A caller loading a different record into the same field never fires a DOM 'input'
      // event; a listener on 'input' alone (the obvious first implementation) would miss it.
      const w = mount(TextField, { props: { modelValue: 'short', multiline: true, autogrow: true, maxRows: 100 } })
      const el = w.element as HTMLTextAreaElement
      await w.setProps({ modelValue: 'a completely different, much longer value than before' })
      await nextTick()
      expect(el.style.height).toBe(expectedHeight(el, 480))
      w.unmount()
    })

    it('caps growth at maxRows instead of pushing on whatever it sits in forever', async () => {
      // 480 (the stubbed scrollHeight) would demand far more than 2 rows of height -- this is
      // exactly the held-Enter-key case the cap exists for. Expect the CEILING, not scrollHeight.
      const w = mount(TextField, { props: { modelValue: '', multiline: true, autogrow: true, maxRows: 2 } })
      const el = w.element as HTMLTextAreaElement
      el.value = 'x'
      await w.get('textarea').trigger('input')
      await nextTick()
      const cs = getComputedStyle(el)
      const ceiling = parseFloat(cs.lineHeight) * 2 + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
        + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
      expect(el.style.height).toBe(`${ceiling}px`)
      expect(ceiling).toBeLessThan(480) // otherwise this test could pass for the wrong reason
      w.unmount()
    })

    it('defaults maxRows to 8 rather than requiring every caller to opt in', async () => {
      // Same ceiling formula as above, just leaning on the prop default instead of passing one.
      // Async, unlike a first draft of this test: mount-time grow() runs via the modelValue
      // watcher's OWN nextTick(), so a synchronous assertion right after mount reads
      // el.style.height before that has resolved -- still '', not yet wrong OR right.
      const w = mount(TextField, { props: { modelValue: 'x', multiline: true, autogrow: true } })
      await nextTick()
      const el = w.element as HTMLTextAreaElement
      const cs = getComputedStyle(el)
      const borders = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
      const ceiling = parseFloat(cs.lineHeight) * 8 + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + borders
      expect(el.style.height).toBe(`${Math.min(480 + borders, ceiling)}px`) // 480 + borders: what grow() targets before any cap
      w.unmount()
    })
  })
})

describe('NumberField', () => {
  it('does NOT commit a half-typed number', async () => {
    /* The reason it is its own component. "1." is unparseable, and a field that committed it would
     * write 1 and make 1.5 unreachable. jsdom does not set badInput itself, so it is forced here —
     * the branch under test is what the component does WITH that signal. */
    const w = mount(NumberField, { props: { modelValue: 1 } })
    const el = w.get('input').element as HTMLInputElement
    Object.defineProperty(el, 'validity', { value: { badInput: true }, configurable: true })
    el.value = ''
    await w.get('input').trigger('input')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('commits a genuinely emptied field as undefined', async () => {
    /* The other side of the same signal: an empty value with badInput false is a real clear, and a
     * caller needs to be able to tell "no value" from "mid-typing". */
    const w = mount(NumberField, { props: { modelValue: 5 } })
    const el = w.get('input').element as HTMLInputElement
    Object.defineProperty(el, 'validity', { value: { badInput: false }, configurable: true })
    el.value = ''
    await w.get('input').trigger('input')
    expect(w.emitted('update:modelValue')![0]).toEqual([undefined])
    w.unmount()
  })

  it('commits a complete number', async () => {
    const w = mount(NumberField, { props: { modelValue: 1 } })
    const el = w.get('input').element as HTMLInputElement
    Object.defineProperty(el, 'validity', { value: { badInput: false }, configurable: true })
    el.value = '1.5'
    await w.get('input').trigger('input')
    expect(w.emitted('update:modelValue')![0]).toEqual([1.5])
    w.unmount()
  })

  it('puts the unit INSIDE the box, as a sibling of the input', () => {
    /* A bordered input with a span next to it reads as two controls. The border is on the wrapper
     * precisely so the suffix sits inside it. */
    const w = mount(NumberField, { props: { modelValue: 5, suffix: 'mm' } })
    expect(w.element.tagName).toBe('DIV')
    expect(w.get('.aether-numberfield__suffix').text()).toBe('mm')
    w.unmount()
  })

  it('derives step from precision when step is absent', () => {
    const w = mount(NumberField, { props: { modelValue: 1, precision: 2 } })
    expect((w.get('input').element as HTMLInputElement).step).toBe('0.01')
    w.unmount()
  })
})

describe('Select', () => {
  const options: SelectOption[] = [
    { value: 'none', label: 'None' },
    { value: 'disp', label: 'Displacement' },
  ]
  const groups: SelectGroup[] = [
    {
      label: 'Shell resultants',
      options: [{ value: 'n11', label: 'N11' }],
    },
    {
      label: 'ULS combinations',
      options: [{ value: 'c1', label: 'ULS-1', subtitle: '1.35·G + 1.5·Q' }],
    },
  ]

  it('renders groups as real optgroups, not rows that look like headings', () => {
    /* Grouping is structure: flattened, a load case and a combination become indistinguishable,
     * which in a structural model is a correctness problem rather than a cosmetic one. */
    const w = mount(Select, { props: { modelValue: 'none', options, groups } })
    const gs = w.findAll('optgroup')
    expect(gs.map((g) => g.attributes('label'))).toEqual(['Shell resultants', 'ULS combinations'])
    // flat options stay outside the groups
    expect(w.element.querySelectorAll(':scope > option')).toHaveLength(2)
    w.unmount()
  })

  it('carries a subtitle into the row rather than dropping it', () => {
    const w = mount(Select, { props: { modelValue: 'none', groups } })
    expect(w.findAll('optgroup')[1]!.find('option').text()).toContain('1.35·G + 1.5·Q')
    w.unmount()
  })

  it('reflects modelValue and emits the chosen value', async () => {
    const w = mount(Select, { props: { modelValue: 'none', options } })
    const el = w.element as HTMLSelectElement
    expect(el.value).toBe('none')
    el.value = 'disp'
    await w.trigger('change')
    expect(w.emitted('update:modelValue')![0]).toEqual(['disp'])
    w.unmount()
  })

  it('is the select itself, so id and aria-label reach it', () => {
    const w = mount(Select, {
      props: { modelValue: 'none', options },
      attrs: { id: 'field', 'aria-label': 'Colour field' },
    })
    expect(w.element.tagName).toBe('SELECT')
    expect(w.attributes('id')).toBe('field')
    expect(w.attributes('aria-label')).toBe('Colour field')
    w.unmount()
  })
})

describe('SearchField', () => {
  it('names itself from the placeholder when given no explicit label', () => {
    const w = mount(SearchField, { props: { modelValue: '', placeholder: 'filter by id' } })
    expect(w.get('input').attributes('aria-label')).toBe('filter by id')
    w.unmount()
  })

  it('clears the value and says so, then hands focus back', async () => {
    /* Clearing is almost always followed by retyping, so focus returning to the field is part of
     * the contract rather than a nicety. */
    const w = mount(SearchField, { props: { modelValue: 'beam' }, attachTo: document.body })
    await w.get('.aether-search__clear').trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual([''])
    expect(w.emitted('clear')).toHaveLength(1)
    expect(document.activeElement).toBe(w.get('input').element)
    w.unmount()
  })

  it('marks itself empty vs non-empty, which is what shows the clear button', async () => {
    const w = mount(SearchField, { props: { modelValue: '' } })
    expect(w.classes()).not.toContain('has')
    await w.setProps({ modelValue: 'x' })
    expect(w.classes()).toContain('has')
    w.unmount()
  })

  it('exposes focus(), so a host shortcut need not reach into the DOM', () => {
    const w = mount(SearchField, { props: { modelValue: '' }, attachTo: document.body })
    ;(w.vm as unknown as { focus: () => void }).focus()
    expect(document.activeElement).toBe(w.get('input').element)
    w.unmount()
  })
})
