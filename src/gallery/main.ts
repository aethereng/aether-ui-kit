import { createApp } from 'vue'
import App from './App.vue'

// Kit styles first — it ships a fallback --aether-* palette on :root, and App.vue's own
// :root block overrides it. Same rule the gallery tells consumers to follow.
import '@/styles/ui-kit.css'

// Brand faces (gallery-only devDependencies — the kit itself ships no fonts and no runtime deps).
// Only the weights actually used: Fraunces 600 display, Inter 400/600 body, mono 400/600.
import '@fontsource/fraunces/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/spline-sans-mono/400.css'
import '@fontsource/spline-sans-mono/600.css'

const app = createApp(App)
app.mount('#app')
