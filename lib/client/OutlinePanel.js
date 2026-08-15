import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, } from 'react';
import { collectQuestions, filterQuestions, formatTime, isJumpTargetRow, } from "./outline.js";
/** Stable getSnapshot value while no session is current (uSES contract). */
const NO_SESSION = null;
const JUMP_HEADROOM = 96;
const JUMP_TIMEOUT_MS = 1500;
const FLASH_MS = 1900;
const COPIED_MS = 1500;
/** Grace period before the hover panel collapses (lets the pointer travel). */
const COLLAPSE_DELAY_MS = 240;
/** Rail capacity; older questions fold into the "+N" marker. */
const MAX_BARS = 60;
/**
 * The conversation view's header tablist, scoped to the conversation root:
 * walk up from the scrollport's PARENT (the scrollport itself may contain
 * other tablists, e.g. the trajectory event-details tabs) and return the
 * nearest ancestor containing a `[role="tablist"]`. Never falls back to a
 * document-wide query, so other tablists (trajectory event details,
 * settings, cordis source viewer) are not hit.
 */
function findConversationTablist(scrollport) {
    let node = scrollport.parentElement;
    while (node) {
        const tablist = node.querySelector('[role="tablist"]');
        if (tablist)
            return tablist;
        node = node.parentElement;
    }
    return null;
}
/** RAF that prunes itself from the tracking ref once it fires. */
function scheduleRaf(rafRef, fn) {
    const id = requestAnimationFrame(() => {
        rafRef.current = rafRef.current.filter((x) => x !== id);
        fn();
    });
    rafRef.current.push(id);
}
/** Timeout that prunes itself from the tracking ref once it fires. */
function scheduleTimeout(timeoutRef, fn, ms) {
    const id = window.setTimeout(() => {
        timeoutRef.current = timeoutRef.current.filter((x) => x !== id);
        fn();
    }, ms);
    timeoutRef.current.push(id);
}
export function OutlinePanel({ sessions, useSessions, t }) {
    const current = useSessions((s) => s.current);
    const session = current ? sessions.binding(current)?.session : undefined;
    // Conversation snapshot subscription (spec §1.5): live updates while the
    // session runs, load-older, blank detection — all ride this one store.
    const subscribe = useCallback((onChange) => (session ? session.subscribe(onChange) : () => { }), [session]);
    const getSnapshot = useCallback(() => (session ? session.getSnapshot() : NO_SESSION), [session]);
    const snapshot = useSyncExternalStore(subscribe, getSnapshot);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [copiedKey, setCopiedKey] = useState(null);
    const timeoutsRef = useRef([]);
    const rafsRef = useRef([]);
    const flashedRowRef = useRef(null);
    const collapseTimerRef = useRef(null);
    // Cancel pending jump work (RAFs/timeouts), the flash highlight, and a
    // scheduled hover collapse.
    const clearPending = useCallback(() => {
        for (const id of rafsRef.current)
            window.cancelAnimationFrame(id);
        for (const id of timeoutsRef.current)
            window.clearTimeout(id);
        rafsRef.current = [];
        timeoutsRef.current = [];
        if (collapseTimerRef.current !== null) {
            window.clearTimeout(collapseTimerRef.current);
            collapseTimerRef.current = null;
        }
        if (flashedRowRef.current) {
            flashedRowRef.current.removeAttribute('data-dsh-outline-flash');
            flashedRowRef.current = null;
        }
    }, []);
    // Session change → cancel pending work and collapse (navigate closes the
    // panel, spec §2.1; a mid-jump poll must not target the stale session).
    useEffect(() => {
        clearPending();
        setOpen(false);
    }, [current, clearPending]);
    // Escape closes the panel (hover-opened or tap-pinned).
    useEffect(() => {
        if (!open)
            return;
        const onKey = (event) => {
            if (event.key === 'Escape')
                setOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);
    // Unmount cleanup: cancel pending flash/copied timeouts, jump RAFs, collapse
    // timer, and the flash attribute.
    useEffect(() => clearPending, [clearPending]);
    const allItems = useMemo(() => (snapshot ? collectQuestions(snapshot) : []), [snapshot]);
    const items = useMemo(() => filterQuestions(allItems, query), [allItems, query]);
    const blank = snapshot?.blank ?? true;
    const hasMore = snapshot?.hasMore ?? false;
    const loadingOlder = snapshot?.loadingOlder ?? false;
    // ---- hover-open mechanics (rail ⇄ panel travel survives via the grace) ---
    const cancelCollapse = useCallback(() => {
        if (collapseTimerRef.current !== null) {
            window.clearTimeout(collapseTimerRef.current);
            collapseTimerRef.current = null;
        }
    }, []);
    const scheduleCollapse = useCallback(() => {
        cancelCollapse();
        collapseTimerRef.current = window.setTimeout(() => {
            collapseTimerRef.current = null;
            setOpen(false);
        }, COLLAPSE_DELAY_MS);
    }, [cancelCollapse]);
    const showPanel = useCallback(() => {
        cancelCollapse();
        setOpen(true);
    }, [cancelCollapse]);
    /** Find the chat row for a node key (pure predicate over DOM rows). */
    const findRow = useCallback((key) => {
        const rows = document.querySelectorAll('[data-chat-anchor-key]');
        for (const row of rows) {
            if (isJumpTargetRow(row, key))
                return row;
        }
        return null;
    }, []);
    /** Scroll the row into view (96px headroom) and flash a highlight. */
    const flashAndScroll = useCallback((row) => {
        const scrollport = row.closest('[data-conversation-scroll]') ?? document.querySelector('[data-conversation-scroll]');
        if (scrollport) {
            const flowTop = row.getBoundingClientRect().top - scrollport.getBoundingClientRect().top;
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            scrollport.scrollTo({
                top: scrollport.scrollTop + flowTop - JUMP_HEADROOM,
                behavior: reduced ? 'auto' : 'smooth',
            });
        }
        // A second jump within FLASH_MS: clear the previous row first.
        if (flashedRowRef.current && flashedRowRef.current !== row) {
            flashedRowRef.current.removeAttribute('data-dsh-outline-flash');
        }
        flashedRowRef.current = row;
        row.setAttribute('data-dsh-outline-flash', 'true');
        scheduleTimeout(timeoutsRef, () => {
            if (flashedRowRef.current === row) {
                row.removeAttribute('data-dsh-outline-flash');
                flashedRowRef.current = null;
            }
        }, FLASH_MS);
    }, []);
    /** Jump-to-message algorithm (spec §2.2). */
    const jumpTo = useCallback((key) => {
        // The conversation page must be mounted; abort silently otherwise.
        const scrollport = document.querySelector('[data-conversation-scroll]');
        if (!scrollport)
            return;
        // Ensure the Chat view is active: chat is order 0 — the FIRST tab of the
        // conversation-root tablist, when one exists (setView is idempotent).
        // A profile without extra views has no header tablist at all — that is
        // fine, the rows are already visible.
        const tablist = findConversationTablist(scrollport);
        if (tablist) {
            const firstTab = tablist.querySelector('button[role="tab"]');
            if (firstTab)
                firstTab.click();
        }
        // Poll for the target row regardless of tablist presence — render timing
        // only; the row is guaranteed in the loaded window (it came from the
        // snapshot). Canceled on session change/unmount via clearPending.
        const deadline = Date.now() + JUMP_TIMEOUT_MS;
        const poll = () => {
            const row = findRow(key);
            if (row) {
                flashAndScroll(row);
                setOpen(false);
                return;
            }
            if (Date.now() < deadline) {
                scheduleRaf(rafsRef, poll);
            }
            else {
                console.warn(t('jumpFailed'), { key });
            }
        };
        scheduleRaf(rafsRef, poll);
    }, [findRow, flashAndScroll, t]);
    /** Copy a question's text (clipboard API with execCommand fallback). */
    const copyText = useCallback((text, key) => {
        const done = () => {
            setCopiedKey(key);
            scheduleTimeout(timeoutsRef, () => setCopiedKey((k) => (k === key ? null : k)), COPIED_MS);
        };
        const fallback = () => {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                done();
            }
            catch {
                // clipboard unavailable — ignore
            }
        };
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(done, fallback);
        }
        else {
            fallback();
        }
    }, []);
    // No current session, or a blank session → render nothing (rail included).
    // MUST stay below every hook: this overlay entry stays mounted across
    // session changes, and blank flips false on the first accepted prompt, so a
    // conditional hook would crash React (reviewer MUST-FIX #1).
    if (!current || !session || blank)
        return null;
    // Rail bars: chronological top→bottom, capped at MAX_BARS with the overflow
    // folded into a "+N" marker (the rail is a minimap, not the full list).
    const start = Math.max(0, allItems.length - MAX_BARS);
    const bars = allItems.slice(start);
    const overflow = start;
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "dso-rail", role: "group", "aria-label": t('title'), tabIndex: 0, onMouseEnter: showPanel, onMouseLeave: scheduleCollapse, onFocus: showPanel, onBlur: scheduleCollapse, onClick: (event) => {
                    // Tap (touch) on the strip itself pins/unpins the panel.
                    if (event.target === event.currentTarget)
                        setOpen((v) => !v);
                }, onKeyDown: (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setOpen((v) => !v);
                    }
                }, children: [overflow > 0 && (_jsxs("span", { className: "dso-rail-more", "aria-label": t('moreBars', { count: overflow }), children: ["+", overflow] })), bars.map((item, index) => (_jsx("button", { type: "button", className: "dso-bar", "aria-label": t('barLabel', { n: start + index + 1 }), onClick: () => jumpTo(item.key) }, item.key)))] }), open && (_jsxs("div", { className: "dso-panel", role: "region", "aria-label": t('title'), onMouseEnter: showPanel, onMouseLeave: scheduleCollapse, onFocus: showPanel, onBlur: scheduleCollapse, children: [_jsxs("header", { className: "dso-panel-header", children: [_jsx("span", { className: "dso-panel-title", children: t('title') }), _jsx("span", { className: "dso-panel-count", children: t('count', { count: allItems.length }) }), _jsx("button", { type: "button", className: "dso-panel-close", "aria-label": t('close'), onClick: () => setOpen(false), children: "\u00D7" })] }), _jsx("input", { className: "dso-search", type: "search", value: query, placeholder: t('searchPlaceholder'), "aria-label": t('searchPlaceholder'), onChange: (event) => setQuery(event.target.value) }), _jsx("div", { className: "dso-list", children: items.length === 0 ? (_jsx("div", { className: "dso-empty", children: t('empty') })) : (items.map((item) => (_jsxs("div", { className: "dso-row", children: [_jsxs("button", { type: "button", className: "dso-row-main", onClick: () => jumpTo(item.key), children: [_jsx("span", { className: "dso-turn", children: item.turn !== undefined ? `#${item.turn}` : '' }), _jsx("span", { className: "dso-text", children: item.text }), item.kind === 'steering' && _jsx("span", { className: "dso-steer", children: t('steerTag') }), _jsx("span", { className: "dso-time", children: formatTime(item.time) })] }), _jsx("button", { type: "button", className: copiedKey === item.key ? 'dso-copy dso-copied' : 'dso-copy', "aria-label": copiedKey === item.key ? t('copied') : t('copy'), onClick: () => copyText(item.text, item.key), children: copiedKey === item.key ? t('copied') : t('copy') })] }, item.key)))) }), hasMore && (_jsx("footer", { className: "dso-footer", children: _jsx("button", { type: "button", className: "dso-load-older", disabled: loadingOlder, onClick: () => {
                                void session.loadOlder();
                            }, children: loadingOlder ? t('loadingOlder') : t('loadOlder') }) }))] }))] }));
}
