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
  type: string
  text?: string
  [key: string]: unknown
}

/** Runtime user/steering node payload as the outline reads it. */
export interface OutlineChatData {
  kind?: string
  seq?: number
  time?: number
  content?: OutlineContentBlock[]
}

/**
 * Conversation chat node as the outline reads it (subset of ChatNode).
 * `data` is `unknown` because the real view node types it that way; the
 * payload is narrowed at the read site.
 */
export interface OutlineChatNode {
  key: string
  kind: string
  data?: unknown
  location?: {
    kind: 'turn' | 'step' | 'session' | 'unresolved'
    turn?: { turn?: number }
    step?: { step?: number }
  }
}

/** One Chat target: the node flow and its index, nested under `chat`. */
export interface OutlineChatLike {
  order: readonly string[]
  nodes: { get(key: string): OutlineChatNode | undefined }
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
  chat?: Partial<OutlineChatLike> | undefined
  order?: readonly string[] | undefined
  nodes?: { get(key: string): OutlineChatNode | undefined } | undefined
  /** Older history still exists outside the loaded window (session face). */
  hasMore?: boolean | undefined
  /** The session face is paging older history right now. */
  loadingOlder?: boolean | undefined
}

/** The node flow plus its index, after resolving both contract generations. */
export interface OutlineFlow {
  order: readonly string[]
  nodes: { get(key: string): OutlineChatNode | undefined }
}

/**
 * Resolve one snapshot into the flow to walk, preferring the nested `chat`
 * object and falling back to the top-level store fields.
 *
 * Never throws: a snapshot carrying neither shape yields `undefined`, so the
 * caller renders an empty rail instead of crashing its slot.
 */
export function resolveOutlineFlow(
  snapshot: OutlineSnapshotLike | null | undefined,
): OutlineFlow | undefined {
  if (snapshot === null || snapshot === undefined) return undefined
  const chat = snapshot.chat
  if (chat !== undefined && Array.isArray(chat.order) && chat.nodes !== undefined) {
    return { order: chat.order, nodes: chat.nodes }
  }
  if (Array.isArray(snapshot.order) && snapshot.nodes !== undefined) {
    return { order: snapshot.order, nodes: snapshot.nodes }
  }
  return undefined
}

/** One row of the outline: a user question (or mid-turn steer). */
export interface OutlineItem {
  key: string
  kind: 'user' | 'steering' | string
  seq: number
  time: number
  turn: number | undefined
  text: string
}

const IMAGE_PLACEHOLDER = '[image]'

/**
 * Flatten message content blocks into a single display string: text blocks are
 * joined, image blocks become a placeholder, and whitespace is trimmed and
 * collapsed.
 */
export function flattenQuestionText(content: OutlineContentBlock[]): string {
  return content
    .map((block) => {
      if (block.type === 'text') return block.text ?? ''
      if (block.type === 'image') return IMAGE_PLACEHOLDER
      return ''
    })
    .join(' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Turn number of a node location: step/turn → location.turn.turn, else undefined. */
function turnOf(location: OutlineChatNode['location']): number | undefined {
  if (!location) return undefined
  if (location.kind === 'step' || location.kind === 'turn') return location.turn?.turn
  return undefined
}

/**
 * Walk the chat flow in order, keep user/steering nodes, skip empty text, and
 * produce chronological outline items (spec §2.3).
 */
export function collectQuestions(snapshot: OutlineSnapshotLike): OutlineItem[] {
  const flow = resolveOutlineFlow(snapshot)
  if (flow === undefined) return []
  const items: OutlineItem[] = []
  for (const key of flow.order) {
    const node = flow.nodes.get(key)
    if (!node) continue
    if (node.kind !== 'user' && node.kind !== 'steering') continue
    const data = node.data as OutlineChatData | undefined
    const text = flattenQuestionText(data?.content ?? [])
    if (!text) continue
    items.push({
      key: node.key,
      kind: node.kind,
      seq: data?.seq ?? 0,
      time: data?.time ?? 0,
      turn: turnOf(node.location),
      text,
    })
  }
  return items
}

/** Case-insensitive substring filter over the flattened question text. */
export function filterQuestions(items: OutlineItem[], query: string): OutlineItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => item.text.toLowerCase().includes(q))
}

/** Local `HH:MM` from a unix-ms timestamp (spec §2.3). */
export function formatTime(ms: number): string {
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** Minimal DOM view so the predicate is testable in Node. */
export interface ElementLike {
  getAttribute(name: string): string | null
}

/** Attributes the chat flow renders a node's identity under. */
const JUMP_KEY_ATTRIBUTES = ['data-chat-anchor-key', 'data-chat-flow-key'] as const

/**
 * Pure DOM predicate for the jump loop: is this row the target node?
 *
 * Exact match only, against either attribute the flow wrapper carries — the
 * platform's own anchor lookup uses `data-chat-anchor-key`, and its sibling
 * `data-chat-flow-key` holds the same value, so a row is still found when only
 * one of the two is present.
 */
export function isJumpTargetRow(row: ElementLike, key: string): boolean {
  return JUMP_KEY_ATTRIBUTES.some((attribute) => row.getAttribute(attribute) === key)
}
