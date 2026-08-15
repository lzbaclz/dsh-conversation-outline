/**
 * Locale dictionaries for the outline UI (implementation-spec §2.4).
 *
 * The namespace is merged into `LocaleNamespaceMap` (@deepseek-ai/dsh-client-ui-slots)
 * so `ctx.locale.register(NS, { zh, en })` uses the typed form (every shipped
 * locale required, dictionary keys compile-checked) and slot entries declaring
 * `locale: NS` receive the typed `t` seat. The `import type {}` below loads the
 * target module so the augmentation applies (erased at compile time).
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

export const NS = 'dsh-conversation-outline'

export interface OutlineLocale {
  /** Panel header title / badge aria-label. */
  title: string
  /** Badge / header count, `{count}` substituted. */
  count: string
  searchPlaceholder: string
  empty: string
  loadOlder: string
  loadingOlder: string
  copy: string
  copied: string
  /** Subtle tag on mid-turn steering messages. */
  steerTag: string
  /** Close button aria-label. */
  close: string
  /** Console-only message when a jump cannot find the target row. */
  jumpFailed: string
}

export const zh: OutlineLocale = {
  title: '会话大纲',
  count: '{count} 个问题',
  searchPlaceholder: '搜索问题…',
  empty: '当前会话还没有问题',
  loadOlder: '加载更早',
  loadingOlder: '加载中…',
  copy: '复制',
  copied: '已复制',
  steerTag: '追问',
  close: '关闭',
  jumpFailed: '跳转失败：未找到对应消息',
}

export const en: OutlineLocale = {
  title: 'Outline',
  count: '{count} questions',
  searchPlaceholder: 'Search questions…',
  empty: 'No questions in this conversation yet',
  loadOlder: 'Load older',
  loadingOlder: 'Loading…',
  copy: 'Copy',
  copied: 'Copied',
  steerTag: 'steer',
  close: 'Close',
  jumpFailed: 'Jump failed: target message not found',
}

export const dictionaries = { zh, en }

/** Dictionary key union, used by the LocaleNamespaceMap merge below. */
export type OutlineLocaleKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-conversation-outline': OutlineLocaleKey
  }
}
