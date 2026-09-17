/**
 * Pure logic for the conversation outline (implementation-spec §2.3).
 *
 * Deliberately has NO DOM access and NO React imports so scripts/verify.mjs can
 * import it directly in Node from the tsc output (lib/client/outline.js) and
 * assert the derivations offline.
 *
 * Input shapes are structural "lite" views of the runtime snapshot types
 * (@deepseek-ai/dsh-client-runtime/client) — the real objects are assignable
 * to them, and Node can import this module without the browser type graph.
 */
/** A message content block as the outline reads it (subset of ContentBlock). */
export interface OutlineContentBlock {
    type: string;
    text?: string;
    [key: string]: unknown;
}
/** Runtime user/steering node payload as the outline reads it. */
export interface OutlineChatData {
    kind?: string;
    seq?: number;
    time?: number;
    content?: OutlineContentBlock[];
}
/**
 * Conversation chat node as the outline reads it (subset of ChatNode).
 * `data` is `unknown` because the real view node types it that way; the
 * payload is narrowed at the read site.
 */
export interface OutlineChatNode {
    key: string;
    kind: string;
    data?: unknown;
    location?: {
        kind: 'turn' | 'step' | 'session' | 'unresolved';
        turn?: {
            turn?: number;
        };
        step?: {
            step?: number;
        };
    };
}
/** One Chat target: the node flow and its index, nested under `chat`. */
export interface OutlineChatLike {
    order: readonly string[];
    nodes: {
        get(key: string): OutlineChatNode | undefined;
    };
}
/**
 * Snapshot shape accepted by collectQuestions.
 *
 * Two generations of the DSH contract are accepted, because the Chat node graph
 * moved between them:
 *
 * - `chat.order` / `chat.nodes` — the layout this plugin was written against,
 *   still what `@deepseek-ai/dsh-client-runtime` exposes as
 *   `ConversationSnapshot.chat`;
 * - `order` / `nodes` at the top level — the session-scoped Chat store that
 *   `@deepseek-ai/dsh-client-ui-chat` publishes from 0.1.5-rc.2 on, where
 *   `ConversationSnapshot` no longer carries `chat` at all.
 *
 * Both are optional so "this session has no chat yet" is a valid input rather
 * than a crash: the rail then has nothing to outline.
 */
export interface OutlineSnapshotLike {
    chat?: Partial<OutlineChatLike> | undefined;
    order?: readonly string[] | undefined;
    nodes?: {
        get(key: string): OutlineChatNode | undefined;
    } | undefined;
    /** Older history still exists outside the loaded window (session face). */
    hasMore?: boolean | undefined;
    /** The session face is paging older history right now. */
    loadingOlder?: boolean | undefined;
}
/** The node flow plus its index, after resolving both contract generations. */
export interface OutlineFlow {
    order: readonly string[];
    nodes: {
        get(key: string): OutlineChatNode | undefined;
    };
}
/**
 * Resolve one snapshot into the flow to walk, preferring the nested `chat`
 * object and falling back to the top-level store fields.
 *
 * Never throws: a snapshot carrying neither shape yields `undefined`, so the
 * caller renders an empty rail instead of crashing its slot.
 */
export declare function resolveOutlineFlow(snapshot: OutlineSnapshotLike | null | undefined): OutlineFlow | undefined;
/** One row of the outline: a user question (or mid-turn steer). */
export interface OutlineItem {
    key: string;
    kind: 'user' | 'steering' | string;
    seq: number;
    time: number;
    turn: number | undefined;
    text: string;
}
/**
 * Flatten message content blocks into a single display string: text blocks are
 * joined, image blocks become a placeholder, and whitespace is trimmed and
 * collapsed.
 */
export declare function flattenQuestionText(content: OutlineContentBlock[]): string;
/**
 * Walk the chat flow in order, keep user/steering nodes, skip empty text, and
 * produce chronological outline items (spec §2.3).
 */
export declare function collectQuestions(snapshot: OutlineSnapshotLike): OutlineItem[];
/** Case-insensitive substring filter over the flattened question text. */
export declare function filterQuestions(items: OutlineItem[], query: string): OutlineItem[];
/** Local `HH:MM` from a unix-ms timestamp (spec §2.3). */
export declare function formatTime(ms: number): string;
/** Minimal DOM view so the predicate is testable in Node. */
export interface ElementLike {
    getAttribute(name: string): string | null;
}
/**
 * Pure DOM predicate for the jump loop: is this row the target node?
 *
 * Exact match only, against either attribute the flow wrapper carries — the
 * platform's own anchor lookup uses `data-chat-anchor-key`, and its sibling
 * `data-chat-flow-key` holds the same value, so a row is still found when only
 * one of the two is present.
 */
export declare function isJumpTargetRow(row: ElementLike, key: string): boolean;
