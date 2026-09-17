/**
 * Headless DOM smoke test for the outline rail (no browser, no DSH host).
 *
 * Mounts the REAL built component (`lib/client/OutlinePanel.js`) inside jsdom
 * with a fake sessions service that speaks the DSH 0.1.5-rc.2 contract, then
 * asserts what a user would see:
 *
 *   1. the rail renders one bar per user question;
 *   2. hovering the rail opens the preview panel with one row per question;
 *   3. clicking a bar reaches the jump path (scroll + flash) and closes the panel.
 *
 * Run with `pnpm test:dom` (dev only; `pnpm verify` stays dependency-free).
 */
import { JSDOM } from 'jsdom'

// ---------------------------------------------------------------- DOM harness
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div><div data-conversation-scroll></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
})
const { window } = dom
globalThis.window = window
globalThis.document = window.document
// Node 26 exposes `navigator` as a getter-only global; redefine it instead.
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true, writable: true })
globalThis.HTMLElement = window.HTMLElement
globalThis.Element = window.Element
globalThis.Node = window.Node
globalThis.DOMRect = window.DOMRect
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
globalThis.matchMedia =
  window.matchMedia ??
  ((query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }))
window.matchMedia ??= globalThis.matchMedia

const { createRoot } = await import('react-dom/client')
const React = (await import('react')).default
const { OutlinePanel } = await import('../lib/client/OutlinePanel.js')

// ------------------------------------------------------- fake platform shapes
const CHAT_SNAPSHOT = {
  order: ['13:input-message<u1>', '9:assistant<x>', '13:input-message<u2>'],
  nodes: {
    get(key) {
      return (
        {
          '13:input-message<u1>': {
            key: '13:input-message<u1>',
            kind: 'user',
            data: { kind: 'user', seq: 1, time: 1758000000000, content: [{ type: 'text', text: '第一个问题' }] },
            location: { kind: 'turn', turn: { turn: 1 } },
          },
          '9:assistant<x>': { key: '9:assistant<x>', kind: 'assistant-step', data: {}, location: { kind: 'turn', turn: { turn: 1 } } },
          '13:input-message<u2>': {
            key: '13:input-message<u2>',
            kind: 'user',
            data: { kind: 'user', seq: 5, time: 1758000060000, content: [{ type: 'text', text: '第二个问题' }] },
            location: { kind: 'step', turn: { turn: 2 } },
          },
        }[key] ?? undefined
      )
    },
  },
}

// Snapshots must be reference-stable between changes (the uSES contract the
// real stores honour); returning a fresh object per call loops React.
const chatFeed = {
  getSnapshot: () => CHAT_SNAPSHOT,
  subscribe: () => () => {},
}

const SESSION_SNAPSHOT = { hasMore: false, loadingOlder: false }
const LIST_SNAPSHOT = { current: 's1' }

const sessionBinding = {
  sessionId: 's1',
  session: { getSnapshot: () => SESSION_SNAPSHOT },
  ctx: { uiConversation: { binding: () => ({ target: (name) => (name === 'chat' ? chatFeed : undefined) }) } },
}

const sessions = {
  list: { getSnapshot: () => LIST_SNAPSHOT, subscribe: () => () => {} },
  binding: (id) => (id === 's1' ? sessionBinding : undefined),
  open: () => {},
}

const t = (key, params) => (params?.count !== undefined ? `${key}:${params.count}` : key)

// --------------------------------------------------------------- mount + assert
const container = document.getElementById('root')
const root = createRoot(container)
root.render(React.createElement(OutlinePanel, { sessions, t }))
await new Promise((resolve) => setTimeout(resolve, 50))

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const rail = container.querySelector('.dso-rail')
check('rail renders', rail !== null)
const bars = container.querySelectorAll('.dso-bar')
check('one bar per question', bars.length === 2, `bars=${bars.length}`)

// Hover the rail: React listens for mouseenter through its synthetic system.
rail?.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }))
rail?.dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: false }))
await new Promise((resolve) => setTimeout(resolve, 50))

const panel = container.querySelector('.dso-panel')
check('hover opens the preview panel', panel !== null)
const rows = container.querySelectorAll('.dso-row')
check('panel lists every question', rows.length === 2, `rows=${rows.length}`)
check('row shows the question opening words', rows[0]?.textContent?.includes('第一个问题') === true, rows[0]?.textContent?.trim().slice(0, 40))

// Click the first bar: the jump path must find the chat row, scroll and flash.
const scrollport = document.querySelector('[data-conversation-scroll]')
let scrolled = null
scrollport.scrollTo = (opts) => {
  scrolled = opts
}
const row = document.createElement('div')
row.setAttribute('data-chat-anchor-key', '13:input-message<u1>')
document.body.appendChild(row)
bars[0]?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
await new Promise((resolve) => setTimeout(resolve, 80))

check('clicking a bar scrolls the transcript', scrolled !== null, scrolled ? `top=${Math.round(scrolled.top)}` : 'scrollTo not called')
check('clicking a bar flashes the target row', row.hasAttribute('data-dsh-outline-flash'))
check('jump closes the panel', container.querySelector('.dso-panel') === null)

root.unmount()
const failed = results.filter((r) => !r.ok)
console.log(`\n${failed.length === 0 ? 'DOM SMOKE: all checks passed ✔' : `DOM SMOKE: ${failed.length} check(s) FAILED ✘`}`)
process.exit(failed.length === 0 ? 0 : 1)
