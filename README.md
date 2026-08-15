# dsh-conversation-outline

[![npm](https://img.shields.io/npm/v/dsh-conversation-outline.svg)](https://www.npmjs.com/package/dsh-conversation-outline)
[![license](https://img.shields.io/npm/l/dsh-conversation-outline.svg)](LICENSE)

DeepSeek Harness 的「会话大纲」客户端插件：在 Web GUI **右侧提供一条常驻细竖条（会话 minimap）**，
每个问题对应一根小横条；**鼠标悬停后展开预览面板**，列出每个问题开头的几个字（超出省略），支持
**搜索**、**加载更早**与**点击跳转**（切到 Chat 视图 → 滚动定位 → 高亮闪烁）。界面中英双语
（zh-CN / en），跟随 DSH 界面语言。

A Codex-style conversation outline for DeepSeek Harness: a slim always-visible
right-edge rail (one bar per question), expanding on hover into a preview panel
of question openings, with search, load-older and click-to-jump. Bilingual
zh-CN / en.

## 特性 / Features

- **右侧细条（Rail）**：会话右侧常驻一条窄窄的竖条，每个问题一根小横条（minimap），
  平时不占地方、不影响阅读；超过 60 个问题时折叠为顶部 `+N` 标记。
- **悬停展开（Hover panel）**：鼠标移到细条上，右侧滑出预览面板——每个问题显示开头几个字
  （单行截断）、`#轮次` 徽标与 `HH:MM` 时间；鼠标移开自动收起（240ms 缓冲），触屏设备点击
  细条可固定面板，`Esc` 关闭。
- **点击跳转**：点击细条上的小横条或面板里的任意一行 → 切到 Chat 视图 → 滚动到对应消息 →
  1.8s 高亮闪烁（尊重 `prefers-reduced-motion`）。
- **搜索**：面板顶部搜索框，大小写不敏感的子串过滤。
- **加载更早**：面板底部 `加载更早 / Load older` 按钮，调用会话 `loadOlder()` 分页翻历史。
- **实时更新**：会话进行中，新问题自动出现（订阅会话快照）。
- **会话隔离**：跟随当前会话；切换会话时面板自动收起、细条按新会话重算。
- **双语 i18n**：zh-CN / en，随 DSH 界面语言切换。

## 界面预览 / Preview

> TODO：截图占位 — 发布前在 `assets/ui.png` 放一张面板截图并替换下方图片链接。

![会话大纲面板](assets/ui.png)

## 安装 / Install

**前置要求**：已安装 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness)
（`dsh` 命令可用）；Node.js `^22.19` 或 `>=24`；pnpm 10+。

### 1. 从 npm（发布后，推荐）

```sh
npx -p @deepseek-ai/dsh dsh plugin --profile web add dsh-conversation-outline
```

### 2. 从 GitHub（未发布 / 用最新提交）

```sh
npx -p @deepseek-ai/dsh dsh plugin --profile web add github:<owner>/dsh-conversation-outline
```

> **无需构建脚本**：本仓库把构建产物 `lib/` 一并提交进 Git（`.gitignore` 不忽略 `lib`），
> 因此 GitHub 安装拿到的就是可直接加载的产物，不需要 `prepare` 构建脚本，也不需要
> 在 profile 里配置 `allowBuilds`——安装即用，零交互。

### 3. 从源码（本地开发）

```sh
git clone <your-repo-url> dsh-conversation-outline
cd dsh-conversation-outline
pnpm install
pnpm dev:types     # 把 @deepseek-ai 类型符号链接进 node_modules（一次性）
pnpm build
dsh plugin --profile web add "link:$(pwd)"
```

> **重启生效**：安装 / 升级 / host 侧改动后，重启正在运行的 DeepSeek Harness Web 服务并刷新页面。

装好后用以下命令确认插件在 profile 里：

```sh
dsh plugin --profile web list
```

## 使用 / Usage

安装并重启后，会话右侧出现一条细竖条（当前会话的「问题 minimap」）：

1. **悬停展开**：鼠标移到细条上，右侧滑出预览面板（每个问题开头几个字 + `#轮次` + 时间）；
   鼠标移开自动收起。触屏设备点击细条可固定面板，`Esc` 或 × 关闭。
2. **跳转**：点击细条上的小横条或面板里的任意问题行——DSH 切到 Chat 视图，滚动到那条消息
   并闪烁高亮。
3. **搜索**：在面板顶部搜索框输入关键字，列表即时过滤。
4. **翻历史**：点击底部 `加载更早 / Load older` 加载更早的问题（按钮在加载中置灰）。
5. **复制**：鼠标移到某行，点复制按钮即可拷贝该问题全文。

## 开发 / Development

```sh
pnpm dev:types   # 符号链接 @deepseek-ai 类型（首次 / node_modules 重建后）
pnpm install
pnpm typecheck   # host + client 双 tsc program 类型检查
pnpm build       # tsc(host) → tsc(client) → tsdown 打包 lib/client.js
pnpm verify      # 离线冒烟：manifest/exports/patch/产物形状 + 纯逻辑断言
```

### 本地调试

1. 用一个**独立的 scratch profile**（不要动正在运行的实例）。关键：新 scratch profile
   的 bundles 里只有 `@deepseek-ai/dsh-base`，**必须再手动补上官方 web-app bundle**，
   否则 Web 启动会一直挂起：

   ```sh
   tmp=$(mktemp -d)   # 独立临时 DSH_HOME，用完即弃
   # 1) 安装插件本身（路径安装）
   DSH_HOME=$tmp npx -p @deepseek-ai/dsh dsh plugin --profile scratch add "$(pwd)"
   # 2) 关键步骤：补官方 web-app bundle（缺失时 scratch Web 启动挂起）
   DSH_HOME=$tmp npx -p @deepseek-ai/dsh dsh plugin --profile scratch add \
     /Users/liziqing/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-web-app
   # 3) 在空闲端口启动（避开已占用的 3080 等）
   DSH_HOME=$tmp npx -p @deepseek-ai/dsh dsh --profile scratch --port 3199
   # 4) 验证完：在另一个终端 kill 掉该 dsh 进程，再 rm -rf "$tmp" 清理临时目录
   ```

2. **客户端改动 + HMR**：`pnpm exec tsdown --watch` 持续重写 `lib/client.js`；
   若同时在 DSH checkout 里跑着 `pnpm run dev:web`，浏览器端会免刷新热更新；
   否则普通 `pnpm build` 后刷新现有 DSH 页面即可（不要另起 Vite server——
   Web shell 依赖 host 注入的 `window.__DSH_BOOT__`）。
3. **host 侧 / manifest 改动**：`src/index.ts`、`package.json`、`exports`、
   `cordis.patch.yml` 的变化需要重启 DSH 服务；manifest 级改动需重新执行
   `dsh plugin add`。

## 文档 / Docs

| 文档 | 内容 |
|---|---|
| [docs/implementation-spec.md](docs/implementation-spec.md) | 权威设计规格：DSH 事实、UI 接缝、跳转算法、验证计划 |
| [docs/publishing-guide.md](docs/publishing-guide.md) | 发布指南：许可证、GitHub 仓库、npm/GitHub 分发、发布流程 |

## License

MIT — 见 [LICENSE](LICENSE)。
