# ISSUES

Tracked defects in `@aether/ui-kit`. Newest first.

## [BUG] `exports` map points at two nonexistent subpath entrypoints
- **Found:** 2026-08-08 — while wiring the AetherOS Drawer against `@aether/ui-kit/property-editor`.
- **Severity:** blocking for any consumer that imports via the package `exports` (rather than raw source files).

### Symptom
`package.json` `exports` declares three subpaths, but only one resolves:

| subpath | maps to | resolves? |
|---|---|---|
| `./property-editor` | `./src/property-editor/vue/index.ts` | **NO** — only `PropertyEditor.vue` exists; no `index.ts` |
| `./property-editor/core` | `./src/property-editor/core/index.ts` | yes |
| `./property-editor/element` | `./src/property-editor/element/index.ts` | **NO** — the element/ web-component wrapper was never implemented |

### Impact
A consumer using the package normally (`import PropertyEditor from '@aether/ui-kit/property-editor'`) cannot resolve the entry — the types and module both 404. AetherOS currently works around this by aliasing the two source files directly in `vite.config.ts` + `tsconfig.json` paths (per the "zero changes to aether-ui-kit" rule during the AetherOS build). That bypasses the package contract and is **not** a fix for the kit itself.

### Fix (kit owner)
- Either add `src/property-editor/vue/index.ts` that re-exports `PropertyEditor` from `./PropertyEditor.vue`, or repoint `"./property-editor"` to `./src/property-editor/vue/PropertyEditor.vue`.
- Either implement `src/property-editor/element/index.ts`, or remove the `"./property-editor/element"` export until it exists.
- Add a type-check / build smoke test that imports every declared subpath so broken exports fail CI.

### Evidence
- `ls src/property-editor/vue/` → only `PropertyEditor.vue` (no `index.ts`).
- `ls src/property-editor/element/` → directory does not exist.
- `package.json` `exports` block (lines 15–28) confirms the three mappings.
