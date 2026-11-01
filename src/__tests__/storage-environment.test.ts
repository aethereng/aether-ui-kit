import { describe, it, expect } from 'vitest'

/* The kit's theme keeps the reader's choice in the browser's storage, and its tests run on the store
 * jsdom holds. A Node with web storage of its own keeps that store out of reach: vitest leaves a global
 * that is already there unless the name is on its own list, and `localStorage` is not. Node's global
 * reads as undefined with no storage file given, so every test of storage would fail far from the
 * reason. vitest.config.ts turns the global off for the workers; this says so by name if that stops. */
describe('the suite runs on the document’s storage', () => {
  const dom = (globalThis as unknown as { jsdom: { window: { localStorage: Storage } } }).jsdom.window

  it('finds the store jsdom holds', () => {
    expect(dom.localStorage, 'precondition: jsdom holds a store').toBeDefined()
  })

  it('and a test reaches that store through the global', () => {
    expect(globalThis.localStorage, 'another localStorage hides jsdom’s; see vitest.config.ts').toBe(dom.localStorage)
  })

  it('which keeps what is written to it', () => {
    localStorage.setItem('storage-environment', 'kept')
    expect(dom.localStorage.getItem('storage-environment')).toBe('kept')
    localStorage.removeItem('storage-environment')
  })
})
