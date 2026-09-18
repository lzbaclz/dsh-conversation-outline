import type { ReactElement } from 'react';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import { NS } from './locales.ts';
import type { OutlineChatFeed } from './outline.ts';
/**
 * Conversation-outline rail + hover panel (implementation-spec §2.1/§2.2,
 * revised per user feedback): NO top-right badge — instead a thin, always-
 * visible right-edge rail (one bar per question, like a conversation minimap).
 * Hovering the rail expands a preview panel listing each question's opening
 * words (single-line truncated); clicking the rail or a bar opens/pins it, and
 * clicking a row jumps to that message.
 *
 * Rendered by the shell as a `shell.overlay` entry (frame-wide, click-through
 * layer). Props come from the composed contract — the injected sessions service
 * face and the typed `t` seat for our locale namespace. The current session is
 * read from `sessions.list` directly (the 0.1.5-rc.2 standard kit exposes the
 * same feed as `ISessions.list`), so the component needs no `useSessions` prop.
 */
export interface OutlinePanelProps {
    /**
     * The sessions service face, injected by the registration: resolves the
     * session binding whose `.session` face carries history pagination.
     */
    sessions: ISessions;
    /**
     * Chat-feed resolver injected by the registration. It closes over the
     * conversation service captured from the plugin's OWN context, because cordis
     * refuses service reads on a foreign context and throws on undeclared ones.
     * Tolerates `undefined` (no current session) by yielding `undefined`.
     */
    resolveChatFeed: (binding: unknown) => OutlineChatFeed | undefined;
    /** Typed translate seat for our namespace (declared via `locale: NS`). */
    t: TranslateNS<typeof NS>;
}
export declare function OutlinePanel({ sessions, resolveChatFeed, t, }: OutlinePanelProps): ReactElement | null;
