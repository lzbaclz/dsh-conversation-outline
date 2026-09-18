import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { OutlineChatFeed } from './outline.ts';
/**
 * Client entry (implementation-spec §1.1/§2.4): the browser half of the
 * plugin. Cordis services this fiber waits for before apply() runs.
 *
 * `uiConversation` is declared here on purpose: cordis guards `ctx` with a
 * Proxy that THROWS on an undeclared service read, and the rail reaches the
 * session's Chat store through it. Reading it off another context (e.g.
 * `binding.ctx.uiConversation`) is not allowed even after declaring it — the
 * guard is per-context, so `apply` captures it from its own ctx below.
 */
export declare const inject: string[];
/** Structural face of the conversation service the rail needs (no value import). */
export interface UiConversationLike {
    binding?: (source: unknown) => {
        target?: (name: string) => unknown;
    } | undefined;
}
export declare function apply(ctx: ClientContext): void;
/**
 * Resolve one session binding's Chat feed through the conversation service.
 *
 * Returns `undefined` for every failure mode — no service (host without
 * ui-conversation), no binding (no current session), no `chat` target — so the
 * rail renders nothing instead of throwing inside its slot. Throwing here is
 * especially costly: the slot error boundary swallows it and the plugin simply
 * disappears with no visible error.
 */
export declare function resolveChatFeed(binding: unknown): OutlineChatFeed | undefined;
