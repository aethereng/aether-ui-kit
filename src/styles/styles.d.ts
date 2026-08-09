/* Type stub for the `@aether/ui-kit/styles` entry point.
 *
 * That subpath resolves to a .css file, which TypeScript cannot type — so under
 * moduleResolution "bundler" a consumer writing `import '@aether/ui-kit/styles'` gets
 * TS2882 ("cannot find module or type declarations for side-effect import"). vite/client's
 * `declare module '*.css'` does not cover it, because this is a bare package specifier
 * rather than a file path. Declaring the module here fixes it for every consumer instead
 * of making each app carry its own ambient shim.
 */
declare module '@aether/ui-kit/styles'
