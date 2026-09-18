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
export declare const OFFICIAL_NAV_SELECTORS: string;
/** Root attribute that keeps the built-in rail visible (escape hatch). */
export declare const KEEP_OFFICIAL_NAV_ATTRIBUTE = "data-dsh-outline-keep-turn-nav";
/** Marker the CSS uses to hide the rail; also the cleanup ledger key. */
export declare const OFFICIAL_NAV_HIDDEN_ATTRIBUTE = "data-dsh-outline-hides-official-nav";
/** Minimal scheduling surface, injectable so tests need no animation frames. */
export interface NavHideScheduler {
    request: (callback: () => void) => number;
    cancel: (handle: number) => void;
    observe: (target: Node, callback: () => void) => () => void;
}
/**
 * Hide the built-in rail and keep it hidden across view rebuilds.
 *
 * @param doc - document to operate on (injectable for tests).
 * @param scheduler - frame + observer factory (injectable for tests).
 * @returns disposer that restores every element it marked.
 */
export declare function hideOfficialTurnNavigation(doc: Document, scheduler?: NavHideScheduler): () => void;
