import type { Context as ClientContext } from '@deepseek-ai/cordis';
/**
 * Client entry (implementation-spec §1.1/§2.4): the browser half of the
 * plugin. Cordis services this fiber waits for before apply() runs.
 */
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
