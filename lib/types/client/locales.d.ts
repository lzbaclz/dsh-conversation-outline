export declare const NS = "dsh-conversation-outline";
export interface OutlineLocale {
    /** Panel header title / rail aria-label. */
    title: string;
    /** Header count, `{count}` substituted. */
    count: string;
    searchPlaceholder: string;
    empty: string;
    loadOlder: string;
    loadingOlder: string;
    copy: string;
    copied: string;
    /** Subtle tag on mid-turn steering messages. */
    steerTag: string;
    /** Close button aria-label. */
    close: string;
    /** Console-only message when a jump cannot find the target row. */
    jumpFailed: string;
    /** Rail bar aria-label, `{n}` = 1-based question ordinal. */
    barLabel: string;
    /** Rail "+N" overflow marker aria-label, `{count}` substituted. */
    moreBars: string;
}
export declare const zh: OutlineLocale;
export declare const en: OutlineLocale;
export declare const dictionaries: {
    zh: OutlineLocale;
    en: OutlineLocale;
};
/** Dictionary key union, used by the LocaleNamespaceMap merge below. */
export type OutlineLocaleKey = keyof typeof zh;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'dsh-conversation-outline': OutlineLocaleKey;
    }
}
