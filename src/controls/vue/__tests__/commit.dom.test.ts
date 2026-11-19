import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import TextField from '../TextField.vue'
import NumberField from '../NumberField.vue'

/* A text or number field commits on Enter or on leaving the box. While the user types nothing moves under
 * the caret, whatever the parent does with each keystroke; at the commit a value the parent refused snaps
 * back to the one it holds. These tests give the field a parent that refuses, and one that accepts, and
 * read the box the user sees (the input's own value, not a prop). */

afterEach(() => {
  document.body.innerHTML = ''
})

/* Two ticks: the parent's answer, then the repair that follows it. */
async function settled() {
  await nextTick()
  await nextTick()
}

describe('TextField commits on Enter or on leaving the box', () => {
  function mountText(modelValue: string, multiline = false) {
    const asked: string[] = []
    const w = mount(TextField, {
      props: { modelValue, multiline, 'onUpdate:modelValue': (v: string) => asked.push(v) },
      attachTo: document.body,
    })
    const el = w.element as HTMLInputElement | HTMLTextAreaElement
    el.focus()
    return { w, el, asked }
  }
  async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await settled()
  }

  it('leaves what is typed alone while the parent refuses every keystroke', async () => {
    const { w, el, asked } = mountText('ab')
    await type(el, 'abc')
    expect(asked).toEqual(['abc'])
    expect(el.value).toBe('abc')
    await type(el, 'abcd')
    expect(el.value).toBe('abcd')
    w.unmount()
  })

  it('draws the held value again on Enter when the parent refused', async () => {
    const { w, el } = mountText('ab')
    await type(el, 'abc')
    await w.get('input').trigger('keydown.enter')
    await settled()
    expect(el.value).toBe('ab')
    w.unmount()
  })

  it('draws the held value again on leaving the box when the parent refused', async () => {
    const { w, el } = mountText('ab')
    await type(el, 'abc')
    el.blur()
    await settled()
    expect(el.value).toBe('ab')
    w.unmount()
  })

  it('keeps what the parent accepted, on Enter and on leaving the box', async () => {
    const { w, el } = mountText('ab')
    await type(el, 'abc')
    await w.setProps({ modelValue: 'abc' })
    await w.get('input').trigger('keydown.enter')
    el.blur()
    await settled()
    expect(el.value).toBe('abc')
    w.unmount()
  })

  it('draws what the parent answered when it answered with another value', async () => {
    const { w, el } = mountText('ab')
    await type(el, 'abc')
    await w.setProps({ modelValue: 'ABC' })
    await w.get('input').trigger('keydown.enter')
    await settled()
    expect(el.value).toBe('ABC')
    w.unmount()
  })

  it('does not treat the Enter that confirms an IME candidate as a commit', async () => {
    const { w, el } = mountText('ab')
    await type(el, 'abc')
    await w.get('input').trigger('keydown', { key: 'Enter', isComposing: true })
    await settled()
    expect(el.value).toBe('abc')
    w.unmount()
  })

  it('leaves a textarea alone on Enter, which is a new line there, and draws the held value on leaving it', async () => {
    const { w, el } = mountText('ab', true)
    await type(el, 'ab\nc')
    await w.get('textarea').trigger('keydown.enter')
    await settled()
    expect(el.value).toBe('ab\nc')
    el.blur()
    await settled()
    expect(el.value).toBe('ab')
    w.unmount()
  })
})

describe('NumberField commits on Enter or on leaving the box', () => {
  function mountNumber(modelValue: number | undefined) {
    const asked: Array<number | undefined> = []
    const w = mount(NumberField, {
      props: { modelValue, 'onUpdate:modelValue': (v: number | undefined) => asked.push(v) },
      attachTo: document.body,
    })
    const el = w.get('input').element as HTMLInputElement
    Object.defineProperty(el, 'validity', { value: { badInput: false }, configurable: true })
    el.focus()
    return { w, el, asked }
  }
  async function type(el: HTMLInputElement, value: string) {
    el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await settled()
  }

  it('leaves what is typed alone while the parent refuses every number', async () => {
    const { w, el, asked } = mountNumber(2)
    await type(el, '9')
    expect(asked).toEqual([9])
    expect(el.value).toBe('9')
    w.unmount()
  })

  it('draws the held number again on Enter when the parent refused', async () => {
    const { w, el } = mountNumber(2)
    await type(el, '9')
    await w.get('input').trigger('keydown.enter')
    await settled()
    expect(el.value).toBe('2')
    w.unmount()
  })

  it('draws the held number again on leaving the box when the parent refused', async () => {
    const { w, el } = mountNumber(2)
    await type(el, '9')
    el.blur()
    await settled()
    expect(el.value).toBe('2')
    w.unmount()
  })

  it('keeps what the parent accepted, on Enter and on leaving the box', async () => {
    const { w, el } = mountNumber(2)
    await type(el, '9')
    await w.setProps({ modelValue: 9 })
    await w.get('input').trigger('keydown.enter')
    el.blur()
    await settled()
    expect(el.value).toBe('9')
    w.unmount()
  })

  it('draws an empty box when the parent holds no number and refused the one typed', async () => {
    const { w, el } = mountNumber(undefined)
    await type(el, '9')
    await w.get('input').trigger('keydown.enter')
    await settled()
    expect(el.value).toBe('')
    w.unmount()
  })

  it('leaves an unfinished number alone while it is typed and draws the held one on leaving the box', async () => {
    const { w, el, asked } = mountNumber(2)
    Object.defineProperty(el, 'validity', { value: { badInput: true }, configurable: true })
    await type(el, '')
    expect(asked).toEqual([])
    el.blur()
    await settled()
    expect(el.value).toBe('2')
    w.unmount()
  })

  it('does not treat the Enter that confirms an IME candidate as a commit', async () => {
    const { w, el } = mountNumber(2)
    await type(el, '9')
    await w.get('input').trigger('keydown', { key: 'Enter', isComposing: true })
    await settled()
    expect(el.value).toBe('9')
    w.unmount()
  })
})
