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
const IMAGE_PLACEHOLDER = '[image]';
/**
 * Flatten message content blocks into a single display string: text blocks are
 * joined, image blocks become a placeholder, and whitespace is trimmed and
 * collapsed.
 */
export function flattenQuestionText(content) {
    return content
        .map((block) => {
        if (block.type === 'text')
            return block.text ?? '';
        if (block.type === 'image')
            return IMAGE_PLACEHOLDER;
        return '';
    })
        .join(' ')
        .trim()
        .replace(/\s+/g, ' ');
}
/** Turn number of a node location: step/turn → location.turn.turn, else undefined. */
function turnOf(location) {
    if (!location)
        return undefined;
    if (location.kind === 'step' || location.kind === 'turn')
        return location.turn?.turn;
    return undefined;
}
/**
 * Walk the chat flow in order, keep user/steering nodes, skip empty text, and
 * produce chronological outline items (spec §2.3).
 */
export function collectQuestions(snapshot) {
    const items = [];
    for (const key of snapshot.chat.order) {
        const node = snapshot.chat.nodes.get(key);
        if (!node)
            continue;
        if (node.kind !== 'user' && node.kind !== 'steering')
            continue;
        const data = node.data;
        const text = flattenQuestionText(data?.content ?? []);
        if (!text)
            continue;
        items.push({
            key: node.key,
            kind: node.kind,
            seq: data?.seq ?? 0,
            time: data?.time ?? 0,
            turn: turnOf(node.location),
            text,
        });
    }
    return items;
}
/** Case-insensitive substring filter over the flattened question text. */
export function filterQuestions(items, query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return items;
    return items.filter((item) => item.text.toLowerCase().includes(q));
}
/** Local `HH:MM` from a unix-ms timestamp (spec §2.3). */
export function formatTime(ms) {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}
/** Pure DOM predicate for the jump loop: is this row the target node? */
export function isJumpTargetRow(row, key) {
    return row.getAttribute('data-chat-anchor-key') === key;
}
