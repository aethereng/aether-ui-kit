import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, watch } from 'vue'
import { createThemeController } from '../../core/theme'
import { themeRefs } from '../refs'

/* The refs follow the controller, whichever side turns it, and a watcher hears each turn once. */

afterEach(() => {
  localStorage.clear()
  document.head.innerHTML = ''
})

function made() {
  const night = { dark: true, colors: { surface: '#000' } }
  const day = { dark: false, colors: { surface: '#fff' } }
  const controller = createThemeController({ themes: { night, day }, dark: 'night', light: 'day', storageKey: 'refs-theme', prefix: 'x', paper: false })
  return { controller, night, day }
}

describe('themeRefs', () => {
  it('reads the controller as it opens', () => {
    const { controller, night } = made()
    const refs = themeRefs(controller)
    expect(refs.name.value).toBe(controller.name)
    expect(refs.isDark.value).toBe(true)
    expect(refs.colors.value).toBe(night.colors)
  })

  it('follows a toggle made on the controller or through the refs', () => {
    const { controller, day, night } = made()
    const refs = themeRefs(controller)
    controller.toggle()
    expect(refs.name.value).toBe('day')
    expect(refs.isDark.value).toBe(false)
    expect(refs.colors.value).toBe(day.colors)
    refs.toggle()
    expect(controller.name).toBe('night')
    expect(refs.colors.value).toBe(night.colors)
  })

  it('wakes a watcher once per toggle', async () => {
    const { controller } = made()
    const refs = themeRefs(controller)
    const heard = vi.fn()
    watch(() => refs.name.value, heard)
    refs.toggle()
    await nextTick()
    refs.toggle()
    await nextTick()
    expect(heard.mock.calls.map(([name]) => name)).toEqual(['day', 'night'])
  })
})
