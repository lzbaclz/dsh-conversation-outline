import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ReactElement } from 'react'
import type { GlobalStandardProps, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import { NS } from './locales.ts'
import {
  collectQuestions,
  filterQuestions,
  formatTime,
  isJumpTargetRow,
} from './outline.ts'
import type { OutlineSnapshotLike } from './outline.ts'

/**
 * Conversation-outline rail + hover panel (implementation-spec §2.1/§2.2,
 * revised per user feedback): NO top-right badge — instead a thin, always-
 * visible right-edge rail (one bar per question, like a conversation minimap).
 * Hovering the rail expands a preview panel listing each question's opening
 * words (single-line truncated); clicking the rail or a bar opens/pins it, and
 * clicking a row jumps to that message.
 *
 * Rendered by the shell as a `shell.overlay` entry (frame-wide, click-through
 * layer). Props come from the composed contract — the global standard kit
 * (`useSessions`) and the typed `t` seat for our locale namespace — plus the
 * Chat feed the registration resolves per session (see §data sources).
 */
export interface OutlinePanelProps extends GlobalStandardProps {
  /**
   * The sessions service face, injected by the registration: resolves the
   * binding (its `.session` face carries pagination) and, through its context,
   * the session's Chat store.
   */
  sessions: ISessions
  /** Typed translate seat for our namespace (declared via `locale: NS`). */
  t: TranslateNS<typeof NS>
}

/** One observable Chat source: props read through uSES, updates pushed. */
export interface OutlineChatFeed {
  getSnapshot: () => OutlineSnapshotLike
  subscribe: (onChange: () => void) => () => void
}

/**
 * Stable getSnapshot value while no session (or no feed) is current (uSES
 * contract): an empty flow, so the rail renders nothing instead of throwing on
 * a shape the host did not provide.
 */
const NO_FLOW: OutlineSnapshotLike = { order: [] }

/**
 * Resolve one observable Chat source out of a session binding.
 *
 * The Chat node graph is a session-scoped store, reached exactly the way
 * `@deepseek-ai/dsh-client-ui-chat` reaches it:
 *
 * ```js
 * ctx.uiConversation.binding(binding).target('chat')  // { getSnapshot, subscribe }
 * ```
 *
 * Reading the provider off `binding.ctx` (rather than the root context) keeps
 * this correct under any bus arrangement; a host that does not offer the
 * service yields `undefined`, and the rail then renders nothing instead of
 * crashing the slot.
 */
export function resolveChatFeed(
  binding: { ctx?: { uiConversation?: unknown } } | undefined,
): OutlineChatFeed | undefined {
  const uiConversation = binding?.ctx?.uiConversation as
    | {
        binding?: (source: unknown) => {
          target?: (name: string) => OutlineChatFeed | undefined
        }
      }
    | undefined
  return uiConversation?.binding?.(binding)?.target?.('chat')
}
const JUMP_HEADROOM = 96
const JUMP_TIMEOUT_MS = 1500
const FLASH_MS = 1900
const COPIED_MS = 1500
/** Grace period before the hover panel collapses (lets the pointer travel). */
const COLLAPSE_DELAY_MS = 240
/** Rail capacity; older questions fold into the "+N" marker. */
const MAX_BARS = 60

/**
 * The conversation view's header tablist, scoped to the conversation root:
 * walk up from the scrollport's PARENT (the scrollport itself may contain
 * other tablists, e.g. the trajectory event-details tabs) and return the
 * nearest ancestor containing a `[role="tablist"]`. Never falls back to a
 * document-wide query, so other tablists (trajectory event details,
 * settings, cordis source viewer) are not hit.
 */
function findConversationTablist(scrollport: Element): HTMLElement | null {
  let node: Element | null = scrollport.parentElement
  while (node) {
    const tablist = node.querySelector<HTMLElement>('[role="tablist"]')
    if (tablist) return tablist
    node = node.parentElement
  }
  return null
}

/** RAF that prunes itself from the tracking ref once it fires. */
function scheduleRaf(rafRef: { current: number[] }, fn: () => void): void {
  const id = requestAnimationFrame(() => {
    rafRef.current = rafRef.current.filter((x) => x !== id)
    fn()
  })
  rafRef.current.push(id)
}

/** Timeout that prunes itself from the tracking ref once it fires. */
function scheduleTimeout(
  timeoutRef: { current: number[] },
  fn: () => void,
  ms: number,
): void {
  const id = window.setTimeout(() => {
    timeoutRef.current = timeoutRef.current.filter((x) => x !== id)
    fn()
  }, ms)
  timeoutRef.current.push(id)
}

export function OutlinePanel({
  sessions,
  useSessions,
  t,
}: OutlinePanelProps): ReactElement | null {
  const current = useSessions((s) => s.current)
  // One binding per session, shared by the session face and the Chat feed: the
  // binding is the identity `uiConversation.binding()` caches its per-session
  // target on, so both must be resolved from the same object.
  const binding = useMemo(
    () => (current ? sessions.binding(current) : undefined),
    [sessions, current],
  )
  const session = binding?.session

  // Question flow: the session-scoped Chat store. History pagination lives on
  // the session face, so its two flags are merged in here.
  const chat = useMemo(() => resolveChatFeed(binding), [binding])
  const subscribe = useCallback(
    (onChange: () => void) => (chat ? chat.subscribe(onChange) : () => {}),
    [chat],
  )
  const getSnapshot = useCallback(
    () => (chat ? chat.getSnapshot() : NO_FLOW),
    [chat],
  )
  const chatSnapshot = useSyncExternalStore(subscribe, getSnapshot)
  const snapshot = useMemo<OutlineSnapshotLike>(
    () => ({
      ...chatSnapshot,
      hasMore: session?.getSnapshot?.().hasMore ?? false,
      loadingOlder: session?.getSnapshot?.().loadingOlder ?? false,
    }),
    [chatSnapshot, session],
  )

  // Two independent sources for the panel being open: `pinned` is a click
  // gesture (sticky until Escape / outside click / session change), `hovered`
  // is pointer presence over the rail or the panel. Deriving `open` from both
  // means a click on the rail opens the panel even when no hover event ever
  // fires (touch, synthetic/automation input, or a pointer that entered the
  // strip without crossing its boundary), and a hover preview still collapses
  // on its own once the pointer leaves.
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const open = pinned || hovered
  const [query, setQuery] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  // The question whose jump could not be completed; the panel says so instead
  // of failing silently (the row may sit outside the loaded history window).
  const [jumpFailed, setJumpFailed] = useState<string | null>(null)
  const timeoutsRef = useRef<number[]>([])
  const rafsRef = useRef<number[]>([])
  const flashedRowRef = useRef<Element | null>(null)
  const collapseTimerRef = useRef<number | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // Cancel pending jump work (RAFs/timeouts), the flash highlight, and a
  // scheduled hover collapse.
  const clearPending = useCallback(() => {
    for (const id of rafsRef.current) window.cancelAnimationFrame(id)
    for (const id of timeoutsRef.current) window.clearTimeout(id)
    rafsRef.current = []
    timeoutsRef.current = []
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
    if (flashedRowRef.current) {
      flashedRowRef.current.removeAttribute('data-dsh-outline-flash')
      flashedRowRef.current = null
    }
  }, [])

  /** Close the panel from any trigger: drop the pin and the hover preview. */
  const closePanel = useCallback(() => {
    setPinned(false)
    setHovered(false)
    cancelCollapseRef.current()
  }, [])

  // Session change → cancel pending work and collapse (navigate closes the
  // panel, spec §2.1; a mid-jump poll must not target the stale session).
  useEffect(() => {
    clearPending()
    setPinned(false)
    setHovered(false)
    setJumpFailed(null)
  }, [current, clearPending])

  // Escape closes the panel (hover-opened or click-pinned).
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closePanel])

  // A click anywhere outside the rail and the panel releases a pin, so the
  // panel behaves like every other dismissible overlay on the page.
  useEffect(() => {
    if (!pinned) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (railRef.current?.contains(target) || panelRef.current?.contains(target)) return
      closePanel()
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [pinned, closePanel])

  // Unmount cleanup: cancel pending flash/copied timeouts, jump RAFs, collapse
  // timer, and the flash attribute.
  useEffect(() => clearPending, [clearPending])

  const allItems = useMemo(() => collectQuestions(snapshot), [snapshot])
  const items = useMemo(() => filterQuestions(allItems, query), [allItems, query])
  const hasMore = snapshot?.hasMore ?? false
  const loadingOlder = snapshot?.loadingOlder ?? false

  // ---- open mechanics: click pins, hover previews, grace period between ---
  const cancelCollapse = useCallback(() => {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
  }, [])
  // `closePanel` above runs before this declaration; a ref keeps the two
  // callbacks independent of declaration order.
  const cancelCollapseRef = useRef(cancelCollapse)
  cancelCollapseRef.current = cancelCollapse

  const scheduleCollapse = useCallback(() => {
    cancelCollapse()
    collapseTimerRef.current = window.setTimeout(() => {
      collapseTimerRef.current = null
      // Only a preview collapses on its own: a pinned panel stays until it is
      // closed, and a pointer still inside the rail or the panel (Chromium
      // raises no further enter events while the pointer sits still) keeps the
      // preview up.
      if (railRef.current?.matches(':hover') || panelRef.current?.matches(':hover')) return
      setHovered(false)
    }, COLLAPSE_DELAY_MS)
  }, [cancelCollapse])

  /** Pointer entered the rail or the panel: cancel a pending collapse, preview. */
  const onEnter = useCallback(() => {
    cancelCollapse()
    setHovered(true)
  }, [cancelCollapse])

  /** Pointer left: let the grace period decide, unless the panel is pinned. */
  const onLeave = useCallback(() => {
    if (pinned) return
    scheduleCollapse()
  }, [pinned, scheduleCollapse])

  /** A click on the rail (or any bar) opens the panel and keeps it open. */
  const togglePin = useCallback(() => {
    cancelCollapse()
    setPinned((value) => !value)
    setHovered(true)
  }, [cancelCollapse])

  /** The panel's own controls: clicking inside never closes it. */
  const keepOpen = useCallback(() => {
    cancelCollapse()
    setHovered(true)
  }, [cancelCollapse])

  /** Find the chat row for a node key (pure predicate over DOM rows). */
  const findRow = useCallback((key: string): Element | null => {
    // Exact match on either anchor attribute the chat flow renders for a node:
    // `data-chat-anchor-key` is the one the platform's own anchorElement() uses,
    // `data-chat-flow-key` is its sibling on the same wrapper. No guessing at
    // the key's internals — a wrong row is worse than a reported failure.
    const rows = document.querySelectorAll('[data-chat-anchor-key], [data-chat-flow-key]')
    for (const row of rows) {
      if (isJumpTargetRow(row, key)) return row
    }
    return null
  }, [])

  /** Scroll the row into view (96px headroom) and flash a highlight. */
  const flashAndScroll = useCallback((row: Element) => {
    const scrollport =
      row.closest('[data-conversation-scroll]') ?? document.querySelector('[data-conversation-scroll]')
    if (scrollport) {
      const flowTop = row.getBoundingClientRect().top - scrollport.getBoundingClientRect().top
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      scrollport.scrollTo({
        top: scrollport.scrollTop + flowTop - JUMP_HEADROOM,
        behavior: reduced ? 'auto' : 'smooth',
      })
    }
    // A second jump within FLASH_MS: clear the previous row first.
    if (flashedRowRef.current && flashedRowRef.current !== row) {
      flashedRowRef.current.removeAttribute('data-dsh-outline-flash')
    }
    flashedRowRef.current = row
    row.setAttribute('data-dsh-outline-flash', 'true')
    scheduleTimeout(timeoutsRef, () => {
      if (flashedRowRef.current === row) {
        row.removeAttribute('data-dsh-outline-flash')
        flashedRowRef.current = null
      }
    }, FLASH_MS)
  }, [])

  /** Jump-to-message algorithm (spec §2.2). */
  const jumpTo = useCallback(
    (key: string, label?: string) => {
      // The conversation page must be mounted; abort silently otherwise.
      const scrollport = document.querySelector('[data-conversation-scroll]')
      if (!scrollport) return
      setJumpFailed(null)

      // Ensure the Chat view is active: chat is order 0 — the FIRST tab of the
      // conversation-root tablist, when one exists (setView is idempotent).
      // A profile without extra views has no header tablist at all — that is
      // fine, the rows are already visible.
      const tablist = findConversationTablist(scrollport)
      if (tablist) {
        const firstTab = tablist.querySelector<HTMLElement>('button[role="tab"]')
        if (firstTab) firstTab.click()
      }

      // Poll for the target row regardless of tablist presence — render timing
      // only; the row is guaranteed in the loaded window (it came from the
      // snapshot). Canceled on session change/unmount via clearPending.
      const deadline = Date.now() + JUMP_TIMEOUT_MS
      const poll = () => {
        const row = findRow(key)
        if (row) {
          flashAndScroll(row)
          closePanel()
          return
        }
        if (Date.now() < deadline) {
          scheduleRaf(rafsRef, poll)
        } else {
          // Never fail silently: the panel states what happened, and the
          // console keeps the key for bug reports.
          console.warn(t('jumpFailed'), { key })
          setJumpFailed(label ?? key)
        }
      }
      scheduleRaf(rafsRef, poll)
    },
    [findRow, flashAndScroll, t, closePanel],
  )

  /** Copy a question's text (clipboard API with execCommand fallback). */
  const copyText = useCallback((text: string, key: string) => {
    const done = () => {
      setCopiedKey(key)
      scheduleTimeout(timeoutsRef, () => setCopiedKey((k) => (k === key ? null : k)), COPIED_MS)
    }
    const fallback = () => {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
        done()
      } catch {
        // clipboard unavailable — ignore
      }
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback)
    } else {
      fallback()
    }
  }, [])

  // No current session, or a session with nothing to outline → render nothing
  // (rail included). This is driven by the question list, not by the session's
  // `blank` flag: the flag belongs to the conversation snapshot, while the rail
  // is derived from the Chat flow, and a session whose nodes are not loaded yet
  // must not take the slot down. MUST stay below every hook (this overlay entry
  // stays mounted across session changes, so a conditional hook would crash
  // React — reviewer MUST-FIX #1).
  if (!current || !session || allItems.length === 0) return null

  // Rail bars: chronological top→bottom, capped at MAX_BARS with the overflow
  // folded into a "+N" marker (the rail is a minimap, not the full list).
  const start = Math.max(0, allItems.length - MAX_BARS)
  const bars = allItems.slice(start)
  const overflow = start

  return (
    <>
      {/* Right-edge rail: always visible while the session has questions. */}
      <div
        ref={railRef}
        className="dso-rail"
        role="group"
        aria-label={t('title')}
        tabIndex={0}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
        onClick={(event) => {
          // Any click on the strip pins the panel open — the container itself,
          // its padding, or the "+N" marker. Bars stop propagation and reach
          // the same pin through the shared jump gesture below.
          if (event.target === event.currentTarget || event.target instanceof HTMLSpanElement) {
            togglePin()
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            togglePin()
          }
        }}
        data-dso-open={open ? 'true' : undefined}
      >
        {overflow > 0 && (
          <span className="dso-rail-more" aria-label={t('moreBars', { count: overflow })}>
            +{overflow}
          </span>
        )}
        {bars.map((item, index) => (
          <button
            key={item.key}
            type="button"
            className="dso-bar"
            aria-label={t('barLabel', { n: start + index + 1 })}
            onClick={(event) => {
              event.stopPropagation()
              // The bar's own job is the jump; the panel comes up pinned first
              // so a click always has a visible effect, then jumpTo collapses
              // it once the row is on screen.
              setPinned(true)
              setHovered(true)
              jumpTo(item.key, item.text)
            }}
          />
        ))}
      </div>

      {/* Hover-expanded preview panel: question openings, one line each. */}
      {open && (
        <div
          ref={panelRef}
          className="dso-panel"
          role="region"
          aria-label={t('title')}
          data-dso-pinned={pinned ? 'true' : undefined}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onFocus={onEnter}
          onBlur={onLeave}
          onMouseDown={keepOpen}
        >
          <header className="dso-panel-header">
            <span className="dso-panel-title">{t('title')}</span>
            <span className="dso-panel-count">{t('count', { count: allItems.length })}</span>
            <button
              type="button"
              className="dso-panel-close"
              aria-label={t('close')}
              onClick={closePanel}
            >
              ×
            </button>
          </header>

          <input
            className="dso-search"
            type="search"
            value={query}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="dso-list">
            {items.length === 0 ? (
              <div className="dso-empty">{t('empty')}</div>
            ) : (
              items.map((item) => (
                <div className="dso-row" key={item.key}>
                  {/* Row action is a real button; the copy control is its
                      sibling, not a nested interactive element. */}
                  <button
                    type="button"
                    className="dso-row-main"
                    onClick={() => jumpTo(item.key, item.text)}
                  >
                    <span className="dso-turn">{item.turn !== undefined ? `#${item.turn}` : ''}</span>
                    <span className="dso-text">{item.text}</span>
                    {item.kind === 'steering' && <span className="dso-steer">{t('steerTag')}</span>}
                    <span className="dso-time">{formatTime(item.time)}</span>
                  </button>
                  <button
                    type="button"
                    className={copiedKey === item.key ? 'dso-copy dso-copied' : 'dso-copy'}
                    aria-label={copiedKey === item.key ? t('copied') : t('copy')}
                    onClick={() => copyText(item.text, item.key)}
                  >
                    {copiedKey === item.key ? t('copied') : t('copy')}
                  </button>
                </div>
              ))
            )}
          </div>

          {jumpFailed !== null && (
            <p className="dso-jump-failed" role="status" data-dso-jump-failed="true">
              {t('jumpFailed')}
            </p>
          )}

          {hasMore && (
            <footer className="dso-footer">
              <button
                type="button"
                className="dso-load-older"
                disabled={loadingOlder}
                onClick={() => {
                  void session.loadOlder()
                }}
              >
                {loadingOlder ? t('loadingOlder') : t('loadOlder')}
              </button>
            </footer>
          )}
        </div>
      )}
    </>
  )
}
