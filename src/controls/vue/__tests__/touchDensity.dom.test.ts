import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { declared, stylesOf } from '../../../__tests__/sfcRules'

/* On a coarse pointer a control keeps a 44px tap area, and the box it DRAWS keeps the height its
 * content gives it. A floor on the box (`min-height: 44px`) raised both at once, so a toolbar, a header
 * and a row of buttons drew 10 to 30px taller on a phone than on a mouse. The tap area now lives in a
 * ::before that reaches past the box, or in a margin that cancels a padding.
 *
 * jsdom has no layout, so these read the rules: that the box states no floor, and that the tap
 * area states the 44px by the token or the literal. The measure at a real pointer (the drawn height,
 * and what elementFromPoint returns at the tap area's edge) is the gallery's, taken in the round that
 * changed these rules. */

const COARSE = '(pointer: coarse)'

function sharedSheet(): CSSStyleSheet {
  const el = document.createElement('style')
  el.textContent = readFileSync(resolve(__dirname, '../../../styles/ui-kit.css'), 'utf8')
  document.head.append(el)
  return el.sheet!
}

/** The whole text of one rule in the coarse block, so a value jsdom does not model is still read. */
function coarseText(sheet: CSSStyleSheet, selector: string): string {
  const blocks = Array.from(sheet.cssRules).filter(
    (r): r is CSSMediaRule => r instanceof CSSMediaRule && r.media.mediaText === COARSE,
  )
  const rules = blocks
    .flatMap((b) => Array.from(b.cssRules))
    .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText.split(',').some((s) => s.trim() === selector))
  if (!rules.length) throw new Error(`no rule lists ${selector} in @media ${COARSE}`)
  return rules.map((r) => r.cssText).join('\n')
}

function declaresFloor(text: string): boolean {
  return /(^|[\s{;])min-height\s*:/.test(text)
}

describe('Tool: a 44px tap area on a box that keeps its height', () => {
  const sheet = sharedSheet()

  it('states no floor on the box', () => {
    expect(declaresFloor(coarseText(sheet, '.aether-tool'))).toBe(false)
  })

  it('positions the box, so the tap area has something to hang from', () => {
    expect(declared(sheet, '.aether-tool', COARSE)['position']).toBe('relative')
  })

  it('reaches the floor with a ::before that grows only when the box is shorter than it', () => {
    const text = coarseText(sheet, '.aether-tool::before')
    expect(text).toContain('position: absolute')
    expect(text).toMatch(/min\(0px,\s*calc\(\(100% - var\(--aether-touch\)\) \/ 2\)\)/)
  })

  it('leaves the grouped buttons at the dense floor, which their group clips to', () => {
    expect(declared(sheet, '.aether-button-group > .aether-tool', COARSE)['min-height']).toBe('var(--aether-touch-dense)')
  })
})

describe('Disclosure: the header is 44px and the whole of it is the toggle', () => {
  const sheet = stylesOf('controls/vue/Disclosure.vue')

  it('puts the floor on the head, and none on the toggle', () => {
    expect(declared(sheet, '.aether-disclosure__head', COARSE)['min-height']).toBe('var(--aether-touch)')
    expect(declaresFloor(coarseText(sheet, '.aether-disclosure__toggle'))).toBe(false)
  })

  it('stretches the toggle over the head, and pays the head’s padding back inside it', () => {
    const toggle = coarseText(sheet, '.aether-disclosure__toggle')
    expect(toggle).toContain('align-self: stretch')
    expect(toggle).toContain('margin-block: -10px')
    expect(toggle).toContain('padding-block: 10px')
    expect(declared(sheet, '.aether-disclosure__head')['padding']).toBe('10px 14px')
  })
})

describe('Disclosure: the header is 44px under either box-sizing a consumer sets', () => {
  const sheet = stylesOf('controls/vue/Disclosure.vue')

  /* jsdom has no layout, so the drawn height is the head's computed floor plus the padding the head's
   * computed box-sizing adds to it. The consumer's reset is a stylesheet of its own, which the kit's
   * rule has to win against. */
  function drawnHeight(reset: 'content-box' | 'border-box'): number {
    const consumer = document.createElement('style')
    consumer.textContent = `* { box-sizing: ${reset}; }`
    document.head.prepend(consumer)
    const head = document.createElement('div')
    head.className = 'aether-disclosure__head'
    document.body.append(head)
    try {
      // The reset has to reach an element of the consumer's own, or the case below is not the one it names.
      expect(getComputedStyle(document.body).boxSizing).toBe(reset)
      const sizing = getComputedStyle(head).boxSizing
      expect(['border-box', 'content-box']).toContain(sizing)
      expect(declared(sheet, '.aether-disclosure__head', COARSE)['min-height']).toBe('var(--aether-touch)')
      const floor = parseFloat(declared(sharedSheet(), ':root')['--aether-touch'])
      const pad = parseFloat(declared(sheet, '.aether-disclosure__head')['padding'].split(' ')[0])
      return sizing === 'border-box' ? floor : floor + 2 * pad
    } finally {
      head.remove()
      consumer.remove()
    }
  }

  it('draws 44px under a consumer reset to content-box', () => {
    expect(drawnHeight('content-box')).toBe(44)
  })

  it('draws 44px under a consumer reset to border-box', () => {
    expect(drawnHeight('border-box')).toBe(44)
  })
})

describe('FilterRail: the clear button is one line, with a 44px area past it', () => {
  const sheet = stylesOf('controls/vue/FilterRail.vue')

  it('states no floor on the button', () => {
    expect(declaresFloor(coarseText(sheet, '.aether-rail__clear'))).toBe(false)
  })

  it('reaches 44px with a ::before that grows only when the button is shorter', () => {
    const text = coarseText(sheet, '.aether-rail__clear::before')
    expect(text).toContain('position: absolute')
    expect(text).toMatch(/min\(0px,\s*calc\(\(100% - var\(--aether-touch\)\) \/ 2\)\)/)
    expect(declared(sheet, '.aether-rail__clear', COARSE)['position']).toBe('relative')
  })
})

describe('Transport: 28px buttons with a 44px area, and a scrub that does not add height', () => {
  const sheet = stylesOf('controls/vue/Transport.vue')

  it('states no height floor on a button, and keeps the drawn 28px', () => {
    expect(declaresFloor(coarseText(sheet, '.at-btn'))).toBe(false)
    expect(declared(sheet, '.at-btn')['height']).toBe('28px')
  })

  it('reaches 44px with a ::before read off the button, which grows only when it is shorter', () => {
    expect(declared(sheet, '.at-btn', COARSE)['position']).toBe('relative')
    const text = coarseText(sheet, '.at-btn::before')
    expect(text).toContain('position: absolute')
    expect(text).toMatch(/min\(0px,\s*calc\(\(100% - var\(--aether-touch\)\) \/ 2\)\)/)
  })

  it('keeps wrapped rows 18px apart, which is the 9px each of two tap areas reach', () => {
    expect(declared(sheet, '.aether-transport', COARSE)['row-gap']).toBe('18px')
  })

  it('cancels the scrub’s 44px box with a margin, so it adds none to the row', () => {
    const scrub = declared(sheet, '.at-scrub', COARSE)
    expect(scrub['min-height']).toBe('44px')
    expect(scrub['margin-block']).toBe('-8px')
  })
})
