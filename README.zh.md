# dsh-conversation-outline

![banner](assets/banner.png)

[![npm](https://img.shields.io/npm/v/@chestnut23%2Fdsh-conversation-outline.svg)](https://www.npmjs.com/package/@chestnut23/dsh-conversation-outline)
[![npm downloads](https://img.shields.io/npm/dm/@chestnut23%2Fdsh-conversation-outline.svg)](https://www.npmjs.com/package/@chestnut23/dsh-conversation-outline)
[![license](https://img.shields.io/npm/l/@chestnut23%2Fdsh-conversation-outline.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-5FA04E?logo=nodedotjs)](https://nodejs.org/)
[![stars](https://img.shields.io/github/stars/lzbaclz/dsh-conversation-outline.svg)](https://github.com/lzbaclz/dsh-conversation-outline)
[![dsh plugin](https://img.shields.io/badge/dsh-plugin-4d6bfe)](https://github.com/deepseek-ai/DeepSeek-Harness)

[English](README.md) · [使用文档](docs/usage.md) · [常见问题](docs/troubleshooting.md) · [安全说明](docs/security.md) · [发布指南](docs/publishing-guide.md) · [设计规格](docs/implementation-spec.md)

**找到任何一次提问，一键跳回任何一处回答。**

智能体的长对话滚起来没完。`dsh-conversation-outline` 是
[DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) Web 的 **Codex 风格「会话大纲」插件**：
界面右侧一条**常驻细竖条**——每个问题一根小横条，像一张会话的 minimap——**鼠标悬停**即展开
预览面板，列出每个问题开头的几个字。点一下横条或某一行，直接瞬移到 Chat 视图里的那条消息，
并高亮闪烁让你不会看漏。界面中英双语（zh-CN / en）。

## 亮点

- **右侧细条（minimap）**——紧贴右边缘的窄竖条，按时间顺序每个问题一根小横条。
  平时不占地方、不影响阅读；超过 60 个问题折叠为顶部 `+N` 标记。
- **悬停预览**——鼠标移到细条上，面板滑出：每个问题开头几个字（单行截断）、`#轮次`
  徽标与 `HH:MM` 时间。移开 240ms 后自动收起。纯覆盖层，**正文布局纹丝不动**。
- **点击也能打开**——点细条本身（或任意一根小横条）会把面板**钉住**，直到你用 `Esc`、
  × 或点击面板外才关闭；因此触屏、手写笔、自动化脚本这类「永远没有 hover 事件」的场景
  同样可用。
- **点击跳转**——即使停在「轨迹」视图也会自动切回聊天视图，滚动定位并闪烁 1.8s，
  尊重 `prefers-reduced-motion`；万一目标消息不在已加载的历史窗口里，面板会明确告诉你，
  而不是静默失败。
- **搜索 & 加载更早**——大小写不敏感过滤 + 翻历史分页。
- **实时**——会话进行中新问题自动出现；跟随当前会话，切换即收起。
- **运行时零依赖**——浏览器包只引用 React 等平台公共模块，其余全部内联并在构建期
  过「纯度门」检查。

## 安装

**前置要求**：已安装 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness)
（`dsh` 命令可用）且版本 **≥ 0.1.5-rc.2**；Node.js `^22.19` 或 `>=24`；pnpm 10+。
通过 `npx` 运行 DSH 的话，给下面命令加上 `npx -p @deepseek-ai/dsh ` 前缀。
更老的宿主请装插件 `0.1.3`，见[兼容表](docs/troubleshooting.md#compatibility)。

```sh
# 1) GitHub（现在就能装，推荐）
dsh plugin --profile web add github:lzbaclz/dsh-conversation-outline

# 2) npm（发布在你自己的 scope 下；无 scope 的同名包属于另一个无关项目，
#    务必安装 @chestnut23 scope）
dsh plugin --profile web add @chestnut23/dsh-conversation-outline

# 3) 从源码（本地开发）
git clone https://github.com/lzbaclz/dsh-conversation-outline.git
cd dsh-conversation-outline
pnpm install && pnpm build
dsh plugin --profile web add "link:$(pwd)"
```

> **GitHub 路径零构建脚本**：本仓库把构建产物 `lib/` 一并提交（`.gitignore` 故意不忽略），
> `github:` 安装拿到的就是可直接加载的产物——不需要 `prepare` 脚本，也不需要 profile
> 里的 `allowBuilds` 配置。
> **名称提醒**：npm 上**无 scope 的** `dsh-conversation-outline` 属于另一个无关项目；
> 本插件只以 `@chestnut23/dsh-conversation-outline` 发布，请务必安装带 scope 的名字
> （或走上面的 GitHub 路径）。

**安装之后**：重启 DSH Web 服务并刷新页面（`link:` 安装只需在 `pnpm build` 后刷新）。
确认插件在 profile 里：

```sh
dsh plugin --profile web list
```

升级用同一条 `add` 命令（可钉版本：`@chestnut23/dsh-conversation-outline@0.1.4`）。

## 使用

装好重启后，打开任何一个已有消息的会话，右侧边缘会出现细竖条：悬停预览问题；**点击细条
（或小横条）打开并钉住面板**；点列表行跳转；搜索过滤、`加载更早` 翻历史。
完整走查：[docs/usage.md](docs/usage.md)。没看到？先看 [常见问题](docs/troubleshooting.md)。

## 界面预览

> 真实截图占位：装好后把细条 + 面板的截图放到 `assets/ui.png`，就会显示在这里。

![会话大纲](assets/ui.png)

## 开发

```sh
pnpm install     # 安装钉死版本的 @deepseek-ai 0.1.5-rc.2 类型包
pnpm typecheck   # host + client 双 tsc program
pnpm build       # tsc(host) → tsc(client) → tsdown 打包 lib/client.js
pnpm verify      # 离线冒烟：manifest/exports/patch/产物形状 + 纯逻辑断言
```

`pnpm typecheck` 依赖 `@deepseek-ai/*` 包里的 `lib/types/**`。部分安装形态下这些包
**不带声明文件**（Electron 内置副本会裁掉），npm 的 rc 通道发布的类型面也偏薄——这时
typecheck 会报「找不到模块」，但**不影响构建与运行时**。正规做法是让 profile 里的
`@deepseek-ai/*` 指向 DSH 源码 checkout；无论类型环境如何，`pnpm verify` 都会覆盖
与宿主契约相关的逻辑断言。

纯客户端改动可热更新：`pnpm exec tsdown --watch` 持续重写 `lib/client.js`，DSH 的客户端
HMR 链（或简单刷新页面）即可生效。host / manifest 改动需要重启服务。scratch profile
测试配方：[docs/implementation-spec.md §4.2](docs/implementation-spec.md)。

## 一起聊聊

随时欢迎提 issue：[点这里](https://github.com/lzbaclz/dsh-conversation-outline/issues)。
问题、点子、你用这个插件做了什么、截图——都欢迎。

## License

MIT——见 [LICENSE](LICENSE)。纯客户端插件：无遥测、无额外网络请求
（[安全说明](docs/security.md)）。
