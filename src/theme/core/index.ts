// Framework-free: an app's palette on the page, and the controller that owns which theme is on.
// `themeRefs` (theme/refs) gives a Vue app the controller's state as refs.
export { hexToTriple, cssTokens, createThemeController } from './theme'
export type { ThemeDef, ThemeOptions, ThemeController } from './theme'
