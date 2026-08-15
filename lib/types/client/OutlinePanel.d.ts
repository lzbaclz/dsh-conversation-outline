import type { ReactElement } from 'react';
import type { GlobalStandardProps, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client';
import { NS } from './locales.ts';
/**
 * Conversation-outline rail + hover panel (implementation-spec §2.1/§2.2,
 * revised per user feedback): NO top-right badge — instead a thin, always-
 * visible right-edge rail (one bar per question, like a conversation minimap).
 * Hovering the rail expands a preview panel listing each question's opening
 * words (single-line truncated); clicking a bar or a row jumps to that message.
 *
 * Rendered by the shell as a `shell.overlay` entry (frame-wide, click-through
 * layer). Props come from the composed four-share contract — the global
 * standard kit (`useSessions`), the injected sessions service face, and the
 * typed `t` seat for our locale namespace.
 */
export interface OutlinePanelProps extends GlobalStandardProps {
    /** The sessions service face, injected by the registration. */
    sessions: ISessions;
    /** Typed translate seat for our namespace (declared via `locale: NS`). */
    t: TranslateNS<typeof NS>;
}
export declare function OutlinePanel({ sessions, useSessions, t }: OutlinePanelProps): ReactElement | null;
