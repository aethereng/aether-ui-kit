import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThemeController, cssTokens, hexToTriple, type ThemeDef, type ThemeOptions } from '../theme'

/* A palette is data emitted as custom properties, so its failure modes are "a colour is silently
 * absent" or "the wrong theme is on" rather than "a colour looks wrong". These pin the ones no
 * screenshot shows: the triple format, the stylesheet's one selector, which theme a page opens in,
 * what a toggle keeps, and what paper wears. */

describe('hexToTriple', () => {
  it('gives a comma-separated r,g,b triple', () => {
    expect(hexToTriple('#0E1338')).toBe('14,19,56')
    expect(hexToTriple('#171E4A')).toBe('23,30,74')
    expect(hexToTriple('#FFFFFF')).toBe('255,255,255')
    expect(hexToTriple('#000000')).toBe('0,0,0')
  })

  it('expands shorthand', () => {
    expect(hexToTriple('#fff')).toBe('255,255,255')
    expect(hexToTriple('#08f')).toBe('0,136,255')
  })

  it('reads either case and space around the value', () => {
    expect(hexToTriple('#abcdef')).toBe(hexToTriple('#ABCDEF'))
    expect(hexToTriple('  #171E4A  ')).toBe('23,30,74')
  })

  it('gives back a value that is not a hex whole, rather than half-parsed', () => {
    expect(hexToTriple('transparent')).toBe('transparent')
    expect(hexToTriple('rgb(1,2,3)')).toBe('rgb(1,2,3)')
    expect(hexToTriple('#12345')).toBe('#12345')
  })
})

const NIGHT: ThemeDef = { dark: true, colors: { surface: '#171E4A', 'on-surface': '#fff' } }
const DAY: ThemeDef = { dark: false, colors: { surface: '#FFFFFF', 'on-surface': '#000' } }
const THEMES = { night: NIGHT, day: DAY }

describe('cssTokens', () => {
  it('writes one block per theme under its data-theme selector, each role under the prefix', () => {
    const nl = String.fromCharCode(10)
    expect(cssTokens(THEMES, 'x')).toBe(
      [
        '',
        "[data-theme='night'] {",
        '  --x-surface: 23,30,74;',
        '  --x-on-surface: 255,255,255;',
        '}',
        '',
        "[data-theme='day'] {",
        '  --x-surface: 255,255,255;',
        '  --x-on-surface: 0,0,0;',
        '}',
      ].join(nl),
    )
  })

  it('declares nothing outside the prefix', () => {
    const declared = [...cssTokens(THEMES, 'q').matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]!)
    expect(declared).toHaveLength(4)
    expect(declared.every((n) => n.startsWith('--q-'))).toBe(true)
  })
})

/* jsdom has no matchMedia, so each test states the OS preference it opens under. The print query
 * is asked for too; its listener is kept, so a test can fire the print medium. */
let prefersDark = true
let printChange: ((e: { matches: boolean }) => void) | undefined
function stubMedia(): void {
  printChange = undefined
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
        if (query === 'print') printChange = fn
      },
    })),
  )
}

const KEY = 'test-theme'
const options = (more: Partial<ThemeOptions> = {}): ThemeOptions => ({ themes: THEMES, dark: 'night', light: 'day', storageKey: KEY, prefix: 'x', ...more })
const onPage = (): string | null => document.documentElement.getAttribute('data-theme')

beforeEach(() => {
  prefersDark = true
  stubMedia()
  localStorage.clear()
  document.head.innerHTML = ''
  document.documentElement.removeAttribute('data-theme')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createThemeController: which theme a page opens in', () => {
  it('follows the OS when nothing is kept', () => {
    expect(createThemeController(options()).name).toBe('night')
    prefersDark = false
    expect(createThemeController(options()).name).toBe('day')
  })

  it('takes the kept choice over the OS', () => {
    localStorage.setItem(KEY, 'day')
    const theme = createThemeController(options())
    expect(theme.name).toBe('day')
    expect(theme.isDark).toBe(false)
    expect(theme.colors).toBe(DAY.colors)
  })

  it('ignores a kept value that names neither theme', () => {
    localStorage.setItem(KEY, 'dusk')
    prefersDark = false
    expect(createThemeController(options()).name).toBe('day')
  })

  it('puts the tokens on the page once, and the theme on the root, before anything mounts', () => {
    createThemeController(options())
    createThemeController(options())
    const sheets = document.head.querySelectorAll('style')
    expect(sheets).toHaveLength(1)
    expect(sheets[0]!.id).toBe(`x-tokens-${KEY}`)
    expect(sheets[0]!.textContent).toBe(cssTokens(THEMES, 'x'))
    expect(onPage()).toBe('night')
  })
})

describe('createThemeController: where the browser withholds something', () => {
  it('follows the OS when reading the kept choice throws, and the app still starts', () => {
    localStorage.setItem(KEY, 'day')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('site data blocked')
    })
    expect(createThemeController(options()).name).toBe('night')
    prefersDark = false
    expect(createThemeController(options()).name).toBe('day')
  })

  it('follows the OS when reaching storage at all throws, as a browser blocking site data does', () => {
    const own = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('the operation is insecure')
      },
    })
    try {
      expect(() => localStorage, 'precondition: reaching storage throws').toThrow()
      prefersDark = false
      const theme = createThemeController(options())
      expect(theme.name).toBe('day')
      theme.toggle()
      expect(theme.name).toBe('night')
      expect(onPage()).toBe('night')
    } finally {
      if (own) Object.defineProperty(globalThis, 'localStorage', own)
    }
  })

  it('opens dark and still answers print with no matchMedia at all', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(window.matchMedia, 'precondition: no matchMedia').toBeUndefined()
    const added = vi.spyOn(window, 'addEventListener')
    const theme = createThemeController(options())
    expect(theme.name).toBe('night')
    expect(added.mock.calls.map(([type]) => type)).toEqual(['beforeprint', 'afterprint'])
  })

  it('takes a print query that has no addEventListener, as an old browser gives', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query === '(prefers-color-scheme: dark)' })),
    )
    expect(createThemeController(options()).name).toBe('night')
  })

  it('reads as dark with no colours when the theme it is on is not among `themes`', () => {
    const theme = createThemeController(options({ themes: {} }))
    expect(theme.name).toBe('night')
    expect(theme.isDark).toBe(true)
    expect(theme.colors).toEqual({})
  })
})

describe('createThemeController: dispose', () => {
  it('takes off every listener it added, and the print query’s', () => {
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    const printOff = vi.fn()
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        addEventListener: vi.fn(),
        removeEventListener: printOff,
      })),
    )
    createThemeController(options()).dispose()
    const on = added.mock.calls.filter(([t]) => t === 'beforeprint' || t === 'afterprint')
    const off = removed.mock.calls.filter(([t]) => t === 'beforeprint' || t === 'afterprint')
    expect(on, 'precondition: both print listeners were added').toHaveLength(2)
    expect(off.map(([t, fn]) => [t, fn])).toEqual(on.map(([t, fn]) => [t, fn]))
    expect(printOff).toHaveBeenCalledOnce()
  })

  it('stops telling its listeners, and leaves the page in the theme it is on', () => {
    const theme = createThemeController(options())
    const heard: string[] = []
    theme.subscribe((name) => heard.push(name))
    theme.dispose()
    expect(onPage()).toBe('night')
    expect(document.head.querySelectorAll('style')).toHaveLength(1)
    theme.toggle()
    expect(heard).toEqual([])
  })

  it('takes nothing off with paper false, where it added nothing', () => {
    const removed = vi.spyOn(window, 'removeEventListener')
    createThemeController(options({ paper: false })).dispose()
    expect(removed).not.toHaveBeenCalled()
  })
})

describe('createThemeController: toggle', () => {
  it('turns dark to light and back, on the page and in storage', () => {
    const theme = createThemeController(options())
    theme.toggle()
    expect(theme.name).toBe('day')
    expect(onPage()).toBe('day')
    expect(localStorage.getItem(KEY)).toBe('day')
    theme.toggle()
    expect(theme.name).toBe('night')
    expect(theme.isDark).toBe(true)
    expect(theme.colors).toBe(NIGHT.colors)
    expect(localStorage.getItem(KEY)).toBe('night')
  })

  it('works unbound, as a component hands it on', () => {
    const { toggle } = createThemeController(options())
    toggle()
    expect(onPage()).toBe('day')
  })

  it('tells each listener the new name, until it stops listening', () => {
    const theme = createThemeController(options())
    const heard: string[] = []
    const stop = theme.subscribe((name) => heard.push(name))
    theme.toggle()
    theme.toggle()
    stop()
    theme.toggle()
    expect(heard).toEqual(['day', 'night'])
  })

  it('still turns when storage refuses the choice', () => {
    const theme = createThemeController(options())
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('refused')
    })
    theme.toggle()
    expect(theme.name).toBe('day')
    expect(onPage()).toBe('day')
  })
})

describe('createThemeController: paper is light', () => {
  /* Each controller adds its listeners to the one window, and those of earlier tests stay, so
   * these fire the listeners THIS controller added, read from a spy, rather than a window event
   * every controller would hear. */
  function printing(more: Partial<ThemeOptions> = {}) {
    const added = vi.spyOn(window, 'addEventListener')
    const theme = createThemeController(options(more))
    const listener = (type: string) => added.mock.calls.find(([t]) => t === type)?.[1] as (() => void) | undefined
    return { theme, before: listener('beforeprint'), after: listener('afterprint') }
  }

  it('wears the light theme while the page prints, and the reader’s after', () => {
    const { theme, before, after } = printing()
    expect(before && after, 'precondition: both print listeners are added').toBeTruthy()
    before!()
    expect(onPage()).toBe('day')
    expect(theme.name).toBe('night')
    after!()
    expect(onPage()).toBe('night')
  })

  it('follows the print medium too, which a real print and an emulated one both change', () => {
    const { theme } = printing()
    expect(printChange, 'precondition: the print query is listened to').toBeTypeOf('function')
    printChange!({ matches: true })
    expect(onPage()).toBe('day')
    printChange!({ matches: false })
    expect(onPage()).toBe(theme.name)
  })

  it('comes back to the reader’s theme when it is the light one, toggled to in the meantime', () => {
    const { theme, before, after } = printing()
    before!()
    theme.toggle()
    after!()
    expect(theme.name).toBe('day')
    expect(onPage()).toBe('day')
  })

  it('with paper false, prints in the reader’s theme: no print listener at all', () => {
    const { before, after } = printing({ paper: false })
    expect(before).toBeUndefined()
    expect(after).toBeUndefined()
    expect(printChange).toBeUndefined()
  })
})
