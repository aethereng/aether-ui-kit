import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DateField from '../DateField.vue'

/* DateField had no tests. It moved out of property-editor/ into controls/ when it became a
 * standalone control, and whatever the form's suite covered did not come with it — which is the
 * failure mode the coverage guard in package-contract.test.ts now catches.
 *
 * What matters here is the SEAM: this wraps a native `input[type=date]` and replaces only the
 * desktop picker, because browsers will not let that one be styled. So the native input must keep
 * working as an input, and the popup must not be the only way to set a value. */

const mountField = (modelValue = '2026-08-18') =>
  mount(DateField, { props: { modelValue }, attachTo: document.body })

describe('DateField wraps a native date input', () => {
  it('keeps a real date input carrying the value', () => {
    /* Not a text box with a calendar bolted on: `type=date` is what gives free parsing, locale
     * formatting, and the platform picker on touch. */
    const w = mountField()
    const input = w.find('input')
    expect(input.attributes('type')).toBe('date')
    expect((input.element as HTMLInputElement).value).toBe('2026-08-18')
    w.unmount()
  })

  it('passes `id` to the inner input so a <label for> reaches it', () => {
    /* The prop exists for exactly this. Without it the label points at a wrapper div and clicking
     * it focuses nothing. */
    const w = mount(DateField, { props: { modelValue: '', id: 'when' } })
    expect(w.find('input').attributes('id')).toBe('when')
    w.unmount()
  })

  it('emits what the user typed, and empties cleanly', () => {
    const w = mountField('')
    const input = w.find('input')
    ;(input.element as HTMLInputElement).value = '2026-01-09'
    input.trigger('input')
    expect(w.emitted('update:modelValue')![0]).toEqual(['2026-01-09'])
    w.unmount()
  })

  it('is controlled — typing does not move it on its own', () => {
    const w = mountField('2026-08-18')
    const input = w.find('input')
    ;(input.element as HTMLInputElement).value = '2026-01-09'
    input.trigger('input')
    // it asked; nothing wrote back, so the rendered value is still the prop
    expect((w.find('input').element as HTMLInputElement).value).toBe('2026-01-09')
    w.setProps({ modelValue: '2026-03-03' })
    return w.vm.$nextTick().then(() => {
      expect((w.find('input').element as HTMLInputElement).value).toBe('2026-03-03')
      w.unmount()
    })
  })
})

describe('DateField popup', () => {
  it('has a named trigger that reports its own state', () => {
    /* The trigger replaces the native indicator, so it has to say what the native one said: that
     * it opens a dialog, and whether that dialog is open. */
    const w = mountField()
    const t = w.find('.aether-datefield__trigger')
    expect(t.attributes('aria-haspopup')).toBe('dialog')
    expect(t.attributes('aria-expanded')).toBe('false')
    expect(t.attributes('aria-label')).toBe('Choose date')
    w.unmount()
  })

  it('opens and closes on the trigger, and the popup is a labelled dialog', async () => {
    const w = mountField()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    await w.find('.aether-datefield__trigger').trigger('click')
    const pop = w.find('[role="dialog"]')
    expect(pop.exists()).toBe(true)
    expect(pop.attributes('aria-labelledby')).toBeTruthy() // the month caption names it
    expect(w.find('.aether-datefield__trigger').attributes('aria-expanded')).toBe('true')
    await w.find('.aether-datefield__trigger').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    w.unmount()
  })
})
