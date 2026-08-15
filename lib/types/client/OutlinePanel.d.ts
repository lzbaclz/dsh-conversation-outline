import type { ReactElement } from 'react';
import type { GlobalStandardProps, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client';
import { NS } from './locales.ts';
/**
 * Badge + outline panel (implementation-spec §2.1/§2.2).
 *
 * Rendered by the shell as a `shell.overlay` entry (frame-wide, click-through
 * layer): the badge is the pill in the top-right corner, the panel opens on
 * click. Props come from the composed four-share contract — the global
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
