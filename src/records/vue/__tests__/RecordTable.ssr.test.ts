// @vitest-environment node
// The table drawn on a server, where there is no document: it renders its rows and measures nothing.
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import RecordTable from '../RecordTable.vue'
import { PARTS, UNITS, row } from '../../core/__tests__/toy'

describe('a table drawn on a server', () => {
  it('renders its rows where there is no document', async () => {
    expect(typeof document, 'precondition: no document').toBe('undefined')
    const app = createSSRApp({ render: () => h(RecordTable, { kind: PARTS, rows: [row('p1', { size: 0.01 })], units: UNITS, run: () => null }) })
    const html = await renderToString(app)
    expect(html).toContain('data-table-row="p1"')
  })
})
