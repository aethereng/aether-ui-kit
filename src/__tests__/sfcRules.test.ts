import { describe, expect, it } from 'vitest'
import { declared, stylesOf } from './sfcRules'

/* The reader the components' rule pins stand on: a reader that returned nothing would pass any
 * `not.toBe` and fail every `toBe` for the wrong reason, so these prove what it can see and what it
 * refuses. The legend's and the gallery's rules are read here only as known text. */

describe('the rule reader', () => {
  const sheet = stylesOf('viz/vue/Legend.vue')

  it('reads a rule by its selector', () => {
    expect(declared(sheet, '.aether-legend__unit')).toEqual({ opacity: '0.7' })
  })

  it('reads a rule of a selector list by any one of its selectors', () => {
    const gallery = stylesOf('controls/vue/Gallery.vue')
    expect(declared(gallery, '.aether-gallery__card:hover')).toEqual(declared(gallery, '.aether-gallery__card:focus-within'))
  })

  it('reads inside a media block, and keeps that apart from the rule outside it', () => {
    const gallery = stylesOf('controls/vue/Gallery.vue')
    const media = '(max-width: 719.98px)'
    expect(declared(gallery, '.aether-gallery__media', media)['aspect-ratio']).not.toBe(declared(gallery, '.aether-gallery__media')['aspect-ratio'])
  })

  it('refuses a selector the sheet does not have, and a media block it does not have', () => {
    expect(() => declared(sheet, '.aether-legend__nothing')).toThrow('no rule lists')
    expect(() => declared(sheet, '.aether-legend__unit', '(min-width: 1px)')).toThrow('no @media')
  })
})
