import type { ReactElement } from 'react';
import type { GlobalStandardProps, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client';
import { NS } from './locales.ts';
import type { OutlineSnapshotLike } from './outline.ts';
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
    sessions: ISessions;
    /** Typed translate seat for our namespace (declared via `locale: NS`). */
    t: TranslateNS<typeof NS>;
}
/** One observable Chat source: props read through uSES, updates pushed. */
export interface OutlineChatFeed {
    getSnapshot: () => OutlineSnapshotLike;
    subscribe: (onChange: () => void) => () => void;
}
/**
 * Resolve one observable Chat source out of a session binding for the two
 * contract generations DSH shipped:
 *
 * - `binding.ctx.uiConversation.binding(binding).target('chat')` — 0.1.5-rc.2
 *   and later, where the Chat node graph is a session-scoped store and
 *   `ConversationSnapshot` no longer carries `chat`;
 * - the session face itself — earlier builds, whose snapshot still exposes
 *   `chat` (and which `resolveOutlineFlow` prefers when it is present).
 *
 * Reading the provider off `binding.ctx` rather than the root context keeps it
 * correct under any bus arrangement, and a host without the service degrades to
 * the legacy face instead of crashing the slot.
 */
export declare function resolveChatFeed(session: OutlineChatFeed | undefined, binding: {
    ctx?: {
        uiConversation?: unknown;
    };
} | undefined): OutlineChatFeed | undefined;
export declare function OutlinePanel({ sessions, useSessions, t, }: OutlinePanelProps): ReactElement | null;
