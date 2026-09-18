/**
 * Headless DOM smoke test for the outline rail (no browser, no DSH host).
 *
 * Hard-won constraints this harness encodes (each one was a real production
 * crash that a permissive mock had hidden):
 *
 *   1. `ctx` is a GUARDED proxy — reading a service that is not declared in the
 *      plugin's `inject` list throws (`cannot get property "x" without inject`).
 *      The harness builds that guard, so an undeclared read fails here.
 *   2. A foreign context is just as guarded: services must be captured from the
 *      plugin's OWN ctx in `apply`, never read off `binding.ctx`.
 *   3. The no-current-session state (app just opened, session list showing) must
 *      render nothing instead of throwing — the rail mounts before any session.
 *
 * It therefore runs the REAL `apply()` wiring and renders the component the
 * registration produced, instead of hand-made props.
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
globalThis.MutationObserver = window.MutationObserver
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
globalThis.matchMedia =
  window.matchMedia ??
  ((query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }))
window.matchMedia ??= globalThis.matchMedia

const { createRoot } = await import('react-dom/client')
const React = (await import('react')).default
const { apply, inject } = await import('../lib/client/index.js')

// -------------------------------------------------------------- cordis guards
/**
 * Build a context that enforces cordis's service guard: every property read is
 * checked against the plugin's declared `inject` list, like the real service
 * tracker. Reading anything else throws.
 */
function guardedContext(services, declared, disposers = []) {
  const allowed = new Set(declared)
  return new Proxy(
    {
      effect: (fn) => {
        const dispose = fn()
        const disposeAll = () => { if (typeof dispose === 'function') dispose() }
        disposers.push(disposeAll)
        return disposeAll
      },
    },
    {
      get(target, property, receiver) {
        if (typeof property === 'symbol' || property in target) return Reflect.get(target, property, receiver)
        if (!allowed.has(property)) throw new Error(`cannot get property "${String(property)}" without inject`)
        return services[property]
      },
    },
  )
}

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
const chatFeed = { getSnapshot: () => CHAT_SNAPSHOT, subscribe: () => () => {} }
const SESSION_SNAPSHOT = { hasMore: false, loadingOlder: false }
const sessionBinding = {
  sessionId: 's1',
  session: { getSnapshot: () => SESSION_SNAPSHOT },
  // A foreign context that THROWS on any read: the plugin must never reach a
  // service through it (that was bug class #2).
  ctx: new Proxy({}, { get(_target, property) { throw new Error(`foreign context read: ${String(property)} — capture services from the plugin's own ctx instead`) } }),
}

const t = (key, params) => (params?.count !== undefined ? `${key}:${params.count}` : key)

/** One fake host: sessions list state + optional conversation service. */
function host({ current, withUiConversation = true } = {}) {
  const registered = { options: null, component: null }
  const listSnapshot = { current }
  const services = {
    sessions: {
      // Stable snapshot reference: uSES re-renders forever on a fresh object.
      list: { getSnapshot: () => listSnapshot, subscribe: () => () => {} },
      binding: (id) => (id === 's1' ? sessionBinding : undefined),
      open: () => {},
    },
    uiConversation: withUiConversation
      ? { binding: () => ({ target: (name) => (name === 'chat' ? chatFeed : undefined) }) }
      : undefined,
    locale: { register: () => () => {}, bind: () => t },
    slots: {
      inject: (_name, callback) => callback(),
      register: (options, component) => {
        registered.options = options
        registered.component = component
        return () => {}
      },
    },
  }
  return { services, registered }
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 50))

/** Run apply() against a guarded ctx, then render what it registered. */
async function mount(hostSpec) {
  const { services, registered } = host(hostSpec)
  const disposers = []
  apply(guardedContext(services, inject, disposers))
  const container = document.getElementById('root')
  container.innerHTML = ''
  const injected = registered.options.inject ? registered.options.inject() : {}
  const root = createRoot(container)
  root.render(React.createElement(registered.component, { ...injected, t }))
  await settle()
  return { container, root, disposers }
}

console.log(`inject declaration: ${JSON.stringify(inject)}`)
check('declares the conversation service it reads', inject.includes('uiConversation'))
check('declares the services the entry touches', ['slots', 'sessions', 'locale'].every((s) => inject.includes(s)))

// ------------------------------------------- 1. no current session (app just opened)
{
  const { container, root } = await mount({ current: undefined })
  check('no current session → renders nothing, no throw', container.querySelector('.dso-rail') === null && container.children.length === 0)
  root.unmount()
}

// ------------------------------------------- 2. current session → rail + jump
{
  const { container, root } = await mount({ current: 's1' })
  const rail = container.querySelector('.dso-rail')
  check('rail renders for the current session', rail !== null)
  const bars = container.querySelectorAll('.dso-bar')
  check('one bar per question', bars.length === 2, `bars=${bars.length}`)

  rail?.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }))
  rail?.dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: false }))
  await settle()
  check('hover opens the preview panel', container.querySelector('.dso-panel') !== null)
  const rows = container.querySelectorAll('.dso-row')
  check('panel lists every question', rows.length === 2, `rows=${rows.length}`)
  check('row shows the question opening words', rows[0]?.textContent?.includes('第一个问题') === true, rows[0]?.textContent?.trim().slice(0, 24))

  const scrollport = document.querySelector('[data-conversation-scroll]')
  let scrolled = null
  scrollport.scrollTo = (opts) => {
    scrolled = opts
  }
  const row = document.createElement('div')
  row.setAttribute('data-chat-anchor-key', '13:input-message<u1>')
  document.body.appendChild(row)
  bars[0]?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await settle()
  check('clicking a bar scrolls the transcript', scrolled !== null, scrolled ? `top=${Math.round(scrolled.top)}` : 'scrollTo not called')
  check('clicking a bar flashes the target row', row.hasAttribute('data-dsh-outline-flash'))
  check('jump closes the panel', container.querySelector('.dso-panel') === null)
  root.unmount()
}

// ------------------------------------------- 3. host without the service at all
{
  const { container, root } = await mount({ current: 's1', withUiConversation: false })
  check('host without uiConversation → nothing rendered, no throw', container.querySelector('.dso-rail') === null)
  root.unmount()
}

// ------------------------------------------- 4. built-in Turn navigation rail
{
  const officialNav = document.createElement('nav')
  officialNav.setAttribute('aria-label', 'Turn navigation')
  officialNav.setAttribute('class', 'abcdef_slot')
  document.body.appendChild(officialNav)

  const first = await mount({ current: 's1' })
  check(
    'built-in Turn navigation rail is hidden while the plugin is loaded',
    officialNav.hasAttribute('data-dsh-outline-hides-official-nav'),
  )
  check(
    'the plugin never marks its own rail as the built-in one',
    first.container.querySelector('.dso-rail')?.hasAttribute('data-dsh-outline-hides-official-nav') !== true,
  )
  // A rebuilt view replaces the subtree: the observer must re-mark the new node
  // (this is what a hashed-class-only rule cannot guarantee).
  const rebuiltNav = document.createElement('nav')
  rebuiltNav.setAttribute('aria-label', 'Turn navigation')
  rebuiltNav.setAttribute('class', 'zzzzzz_slot')
  document.body.appendChild(rebuiltNav)
  await settle()
  await settle()
  check(
    'a rebuilt built-in rail is re-marked by the observer',
    rebuiltNav.hasAttribute('data-dsh-outline-hides-official-nav'),
  )
  rebuiltNav.remove()

  for (const dispose of first.disposers) dispose()
  check(
    'unloading the plugin restores the built-in rail',
    !officialNav.hasAttribute('data-dsh-outline-hides-official-nav'),
  )
  first.root.unmount()

  // Escape hatch: the root attribute keeps the built-in rail visible.
  document.documentElement.setAttribute('data-dsh-outline-keep-turn-nav', '')
  const second = await mount({ current: 's1' })
  check(
    'opt-out attribute keeps the built-in rail visible',
    !officialNav.hasAttribute('data-dsh-outline-hides-official-nav'),
  )
  for (const dispose of second.disposers) dispose()
  second.root.unmount()
  document.documentElement.removeAttribute('data-dsh-outline-keep-turn-nav')
  officialNav.remove()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${failed.length === 0 ? 'DOM SMOKE: all checks passed ✔' : `DOM SMOKE: ${failed.length} check(s) FAILED ✘`}`)
process.exit(failed.length === 0 ? 0 : 1)
