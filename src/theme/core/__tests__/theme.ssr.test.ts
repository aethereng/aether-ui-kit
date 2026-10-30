// @vitest-environment node
// The controller made where there is no document and no window (a server render, a node test): it
// reads the same and touches nothing.
import { describe, expect, it } from 'vitest'
import { createThemeController } from '../theme'

describe('a theme controller with no document', () => {
  it('opens dark, reads its palette, and turns without a page to set', () => {
    expect(typeof document, 'precondition: no document').toBe('undefined')
    expect(typeof window, 'precondition: no window').toBe('undefined')
    const theme = createThemeController({
      themes: { night: { dark: true, colors: { surface: '#000' } }, day: { dark: false, colors: { surface: '#fff' } } },
      dark: 'night',
      light: 'day',
      storageKey: 'test-theme',
      prefix: 'x',
    })
    expect(theme.name).toBe('night')
    expect(theme.colors).toEqual({ surface: '#000' })
    theme.toggle()
    expect(theme.name).toBe('day')
    expect(theme.isDark).toBe(false)
  })
})
