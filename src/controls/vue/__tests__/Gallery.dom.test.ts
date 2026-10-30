import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import Gallery from '../Gallery.vue'
import { gallerySections, type GalleryFamily, type GalleryItem } from '../../core/gallery'
import { declared, stylesOf } from '../../../__tests__/sfcRules'

const FAMILIES: GalleryFamily[] = [
  { id: 'frames', title: 'Frames', line: 'Members and joints.' },
  { id: 'empty', title: 'Nothing here' },
  { id: 'shells', title: 'Shells' },
]
const ITEMS: GalleryItem[] = [
  { id: 'dome', family: 'shells', title: 'Dome', line: 'A shell.', picture: 'dome.png', foot: 'Checked against a reference', footIcon: 'M1 1' },
  { id: 'portal', family: 'frames', title: 'Portal', line: 'A frame.', picture: 'portal.png', foot: '12 members' },
  { id: 'stray', family: 'gone', title: 'Stray' },
  { id: 'new', family: 'frames', title: 'New', icon: 'M2 2', note: { label: 'Funded', text: 'By a grant.' } },
]

describe('gallerySections', () => {
  it('keeps the families in their order and the items in theirs, leaving out an empty family', () => {
    const sections = gallerySections(FAMILIES, ITEMS)
    expect(sections.map((s) => s.id)).toEqual(['frames', 'shells'])
    expect(sections[0]!.items.map((i) => i.id)).toEqual(['portal', 'new'])
  })

  it('numbers each item by its place in the whole list, section after section', () => {
    const places = gallerySections(FAMILIES, ITEMS).flatMap((s) => s.items.map((i) => [i.id, i.place]))
    expect(places).toEqual([
      ['portal', 0],
      ['new', 1],
      ['dome', 2],
    ])
  })

  it('leaves out an item whose family is not listed', () => {
    expect(gallerySections(FAMILIES, ITEMS).flatMap((s) => s.items.map((i) => i.id))).not.toContain('stray')
  })
})

const gallery = () => mount(Gallery, { props: { families: FAMILIES, items: ITEMS } })
const card = (w: ReturnType<typeof gallery>, id: string) => w.find(`[data-card="${id}"]`)

describe('Gallery: the sections', () => {
  it('draws a section per family that has items, named by its heading', () => {
    const w = gallery()
    const sections = w.findAll('section')
    expect(sections.map((s) => s.attributes('data-family'))).toEqual(['frames', 'shells'])
    for (const s of sections) {
      const heading = s.find('h3')
      expect(heading.attributes('id'), 'precondition: the heading has an id').toBeTruthy()
      expect(s.attributes('aria-labelledby')).toBe(heading.attributes('id'))
    }
  })

  it('gives two galleries on one page different heading ids', () => {
    const props = { families: FAMILIES, items: ITEMS }
    const page = mount({ render: () => [h(Gallery, props), h(Gallery, props)] })
    const ids = page.findAll('[data-family="frames"] h3').map((heading) => heading.attributes('id'))
    expect(ids, 'precondition: both galleries drew the family').toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('draws the line beside a heading only where there is one', () => {
    const w = gallery()
    expect(w.find('[data-family="frames"] .aether-gallery__line').text()).toBe('Members and joints.')
    expect(w.find('[data-family="shells"] .aether-gallery__line').exists()).toBe(false)
  })
})

describe('Gallery: a card', () => {
  it('tells the app which item was opened', async () => {
    const w = gallery()
    await card(w, 'dome').find('button').trigger('click')
    expect(w.emitted('open')).toEqual([['dome']])
  })

  it('is a real button that submits nothing', () => {
    expect(card(gallery(), 'dome').find('button').attributes('type')).toBe('button')
  })

  it('draws the picture with no alt, its box stated and its load put off', () => {
    const img = card(gallery(), 'dome').find('img')
    expect(img.attributes()).toMatchObject({ src: 'dome.png', alt: '', width: '800', height: '500', loading: 'lazy', decoding: 'async' })
  })

  it('draws the icon where it has no picture, and neither where it has neither', () => {
    const w = gallery()
    expect(card(w, 'new').find('img').exists()).toBe(false)
    expect(card(w, 'new').find('.aether-gallery__media--icon svg path').attributes('d')).toBe('M2 2')
    const bare = mount(Gallery, { props: { families: FAMILIES, items: [{ id: 'x', family: 'frames', title: 'X' }] } })
    expect(card(bare, 'x').find('.aether-gallery__media').exists()).toBe(false)
  })

  it('sets the title, the line and the foot in that order', () => {
    const body = card(gallery(), 'portal').find('.aether-gallery__body')
    expect(Array.from(body.element.children).map((e) => e.textContent?.trim())).toEqual(['Portal', 'A frame.', '12 members'])
  })

  it('draws the foot and its icon only where given', () => {
    const w = gallery()
    expect(card(w, 'dome').find('[data-card-foot] svg path').attributes('d')).toBe('M1 1')
    expect(card(w, 'portal').find('[data-card-foot] svg').exists()).toBe(false)
    expect(card(w, 'new').find('[data-card-foot]').exists()).toBe(false)
    expect(card(w, 'new').find('.aether-gallery__text').exists()).toBe(false)
  })

  it('sets a note beside the button, in full, and outside it', () => {
    const w = gallery()
    const note = card(w, 'new').find('[data-card-note]')
    expect(note.text()).toBe('Funded. By a grant.')
    expect(note.find('strong').text()).toBe('Funded.')
    expect(card(w, 'new').find('button [data-card-note]').exists()).toBe(false)
    expect(card(w, 'portal').find('[data-card-note]').exists()).toBe(false)
  })

  it('carries its place for the entrance animation', () => {
    const li = card(gallery(), 'dome').element as HTMLElement
    expect(li.style.getPropertyValue('--place')).toBe('2')
  })
})

describe('Gallery: when its data changes', () => {
  it('draws the picture it is given now, as a theme changes the address', async () => {
    const w = gallery()
    await w.setProps({ items: ITEMS.map((i) => (i.id === 'dome' ? { ...i, picture: 'dome-light.png' } : i)) })
    expect(card(w, 'dome').find('img').attributes('src')).toBe('dome-light.png')
  })
})

describe('Gallery: the rules jsdom does not apply', () => {
  const sheet = stylesOf('controls/vue/Gallery.vue')
  const PHONE = '(max-width: 719.98px)'
  const ratio = (value: string | undefined) => {
    const [w, h] = (value ?? '').split('/').map(Number)
    return w! / h!
  }

  it('lifts a card for the keyboard as for the pointer', () => {
    const lift = declared(sheet, '.aether-gallery__card:focus-within')
    expect(lift.transform).toBe('translateY(-3px)')
    expect(lift).toEqual(declared(sheet, '.aether-gallery__card:hover'))
  })

  it('holds the picture box to the ratio the image states, so nothing moves as it loads', () => {
    const img = card(gallery(), 'dome').find('img')
    const stated = Number(img.attributes('width')) / Number(img.attributes('height'))
    expect(ratio(declared(sheet, '.aether-gallery__media')['aspect-ratio'])).toBe(stated)
  })

  it('falls to one column on a phone, with the pictures cut shorter', () => {
    expect(declared(sheet, '.aether-gallery__grid', PHONE)['grid-template-columns']).toBe('1fr')
    expect(ratio(declared(sheet, '.aether-gallery__media', PHONE)['aspect-ratio'])).toBe(16 / 9)
  })
})
