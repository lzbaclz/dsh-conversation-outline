/**
 * Hide DSH's built-in Turn navigation rail while this plugin is active.
 *
 * Why this exists: the built-in rail marks every *turn* and, in practice, labels
 * its ticks `Turn N` — its prompt preview field is empty, so it never shows what
 * the user actually asked. A measured session had 72 turns and 2 questions, and
 * the ticks are 20x10px with no text, so the rail cannot answer "where is my
 * question". The outline rail answers exactly that, and the two overlap on the
 * same right edge. The escape hatch keeps the choice reversible:
 *
 *   <html data-dsh-outline-keep-turn-nav>   → built-in rail stays visible
 *
 * Identification avoids the CSS-module hash of the day (it changes with every
 * DSH build): the rail is a `<nav aria-label>` the shell renders into a hashed
 * slot, so matching is aria-label based with a structural fallback that pairs an
 * aria-label with a hashed slot class. Switching sessions or views rebuilds that
 * subtree, hence the observer; mutations are coalesced into one animation frame.
 *
 * Everything is reversible: the returned disposer disconnects the observer and
 * removes every marker it set, so unloading the plugin restores the built-in rail.
 */
/** Selectors that identify the built-in Turn navigation rail. */
export const OFFICIAL_NAV_SELECTORS = [
    // Stable, localized labels (English / Simplified Chinese shells).
    'nav[aria-label="Turn navigation"]',
    'nav[aria-label="轮次导航"]',
    // Structural fallback: the shell renders the rail into a hashed slot wrapper,
    // so an aria-labelled <nav> carrying a `*_slot` class is that rail even when a
    // future build renames the label. This plugin never renders a <nav>.
    'nav[aria-label][class*="_slot"]',
].join(', ');
/** Root attribute that keeps the built-in rail visible (escape hatch). */
export const KEEP_OFFICIAL_NAV_ATTRIBUTE = 'data-dsh-outline-keep-turn-nav';
/** Marker the CSS uses to hide the rail; also the cleanup ledger key. */
export const OFFICIAL_NAV_HIDDEN_ATTRIBUTE = 'data-dsh-outline-hides-official-nav';
/**
 * Hide the built-in rail and keep it hidden across view rebuilds.
 *
 * @param doc - document to operate on (injectable for tests).
 * @param scheduler - frame + observer factory (injectable for tests).
 * @returns disposer that restores every element it marked.
 */
export function hideOfficialTurnNavigation(doc, scheduler = browserScheduler()) {
    const root = doc.documentElement;
    const marked = new Set();
    let frame = null;
    const restore = () => {
        for (const element of marked)
            element.removeAttribute(OFFICIAL_NAV_HIDDEN_ATTRIBUTE);
        marked.clear();
    };
    const apply = () => {
        frame = null;
        if (root.hasAttribute(KEEP_OFFICIAL_NAV_ATTRIBUTE)) {
            restore();
            return;
        }
        for (const element of doc.querySelectorAll(OFFICIAL_NAV_SELECTORS)) {
            if (element.hasAttribute(OFFICIAL_NAV_HIDDEN_ATTRIBUTE))
                continue;
            element.setAttribute(OFFICIAL_NAV_HIDDEN_ATTRIBUTE, '');
            marked.add(element);
        }
    };
    const schedule = () => {
        if (frame === null)
            frame = scheduler.request(apply);
    };
    apply();
    const disconnect = scheduler.observe(doc.documentElement, schedule);
    return () => {
        disconnect();
        if (frame !== null) {
            scheduler.cancel(frame);
            frame = null;
        }
        restore();
    };
}
/**
 * The real browser scheduler: one animation frame plus a subtree observer.
 *
 * Degrades safely where either API is missing (a non-DOM test host): the caller
 * has already applied the markers once, and a missing observer only means later
 * rebuilds are not re-marked.
 */
function browserScheduler() {
    const frames = typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function';
    const Observer = typeof MutationObserver === 'undefined' ? undefined : MutationObserver;
    return {
        request: (callback) => (frames ? requestAnimationFrame(callback) : setTimeout(callback, 0)),
        cancel: (handle) => {
            if (frames)
                cancelAnimationFrame(handle);
            else
                clearTimeout(handle);
        },
        observe: (target, callback) => {
            if (Observer === undefined)
                return () => { };
            const observer = new Observer(callback);
            observer.observe(target, { childList: true, subtree: true });
            return () => observer.disconnect();
        },
    };
}
