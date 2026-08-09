import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

// __KIT_VERSION__ is injected by vite.config.ts `define` from package.json, so it exists at
// runtime but not to eslint's scope analysis.
const buildTimeGlobals = { __KIT_VERSION__: 'readonly' }

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  { languageOptions: { globals: buildTimeGlobals } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  prettier,
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    rules: {
      // kit is framework-free core + thin wrappers; keep it lean
      '@typescript-eslint/no-explicit-any': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
    },
  },
)
