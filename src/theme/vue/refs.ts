/* A theme controller's state as Vue refs, for a component's template or a watcher.
 *
 * Callable at module scope, beside the controller: it holds no component lifecycle, so an app
 * makes one for its controller and every part of it reads the same refs. */
import { computed, shallowRef, type ComputedRef } from 'vue'
import type { ThemeController } from '../core/theme'

export interface ThemeRefs {
  /** The active theme's name. */
  name: ComputedRef<string>
  isDark: ComputedRef<boolean>
  /** The active palette, for what cannot read CSS (a WebGL scene). */
  colors: ComputedRef<Record<string, string>>
  /** The controller's toggle. */
  toggle(): void
}

export function themeRefs(controller: ThemeController): ThemeRefs {
  const read = () => ({ name: controller.name, isDark: controller.isDark, colors: controller.colors })
  const state = shallowRef(read())
  controller.subscribe(() => {
    state.value = read()
  })
  return {
    name: computed(() => state.value.name),
    isDark: computed(() => state.value.isDark),
    colors: computed(() => state.value.colors),
    toggle: controller.toggle,
  }
}
