# dsh-conversation-outline 发布指南（Publishing Guide）

本指南面向维护者，覆盖把 `dsh-conversation-outline` 从本地仓库发布到**npm registry**与
**GitHub** 两条分发通道的完整流程：许可证选择、发布前检查、GitHub 仓库创建、版本与
Release 工作流、npm 发布（含命名冲突时的 scoped 兜底）、**GitHub-only 分发**（本仓库的
默认形态）、发布后推广与 FAQ。

权威依据：DSH 插件开发 Skill（`/tmp/dsh-plugin-skill.md` §7「分发、安装与生效边界」、
§8.4「从零安装与 Git 分发」）与本仓库 `docs/implementation-spec.md` §3/§4。

---

## 1. 许可证选择：为什么推荐 MIT

### 1.1 常见许可证对比

| 许可证 | 类型 | 对用户的要求 | 对商业/闭源使用 | 备注 |
|---|---|---|---|---|
| **MIT** | 宽松（permissive） | 保留版权声明即可 | ✅ 完全允许 | 生态默认，单文件、无附加义务 |
| Apache-2.0 | 宽松 | 保留声明 + 标注修改文件 | ✅ 允许 | 含专利授权条款，篇幅较长 |
| BSD-3-Clause | 宽松 | 保留声明 | ✅ 允许 | 与 MIT 类似，多一条禁止用作者名义背书 |
| GPL-3.0 | 强 Copyleft | 衍生作品必须同协议开源 | ⚠️ 传染 | 会吓退不想开源的集成方 |
| Unlicense | 公有领域 | 无 | ✅ 允许 | 放弃一切权利；部分司法辖区有争议 |

### 1.2 推荐：MIT

理由：

1. **生态一致性**：DSH 官方及第三方插件事实标准（参考样例 `@nanmicoder/dsh-agent-teams`
   即 MIT）；用户对 MIT 的心理预期最低。
2. **零义务**：只要求保留版权与许可声明，不限制 DSH 商业部署场景。
3. **可维护**：单文件 `LICENSE` + `package.json` 的 `"license": "MIT"` 字段即可，无专利
   附录等额外内容。
4. **已就位**：仓库根目录已有 `LICENSE`（MIT 全文），`package.json` 已声明 `"license": "MIT"`。

### 1.3 发布前必须修掉的两处占位

- `LICENSE` 第 3 行：`Copyright (c) 2026 your name` → 替换成真实版权人
  （`Copyright (c) 2026 <你的名字或组织>`）。
- `package.json` 的 `repository.url`：`git+https://github.com/<owner>/dsh-conversation-outline.git`
  → 替换为真实仓库地址（创建仓库后回填）。

> 许可证选择一旦公开就极难更改（改协议需要所有贡献者同意），发布前定稿。

---

## 2. 发布前检查清单（Pre-publish Checklist）

逐项确认，全部满足再发版：

- [ ] **包名可用**：`npm view dsh-conversation-outline` 返回 404（`npm error code E404`）
      表示名字未被占用；被占用则走 scoped 兜底（见 §5.3）。
- [ ] **`package.json` 完整**：`name` / `version` / `description` / `keywords` /
      `license` / `engines`（`^22.19.0 || >=24`）/ `files` 白名单 / `repository`（已回填）。
- [ ] **`files` 白名单正确**：`["lib", "assets", "docs", "cordis.patch.yml", "README.md", "README.zh.md", "LICENSE"]`——
      `lib/` 是唯一产物目录，`cordis.patch.yml` 是 bundle patch，二者缺一不可；
      横幅图（assets）、导航文档（docs）与中英两份 README 一并随包发布。
- [ ] **构建与校验全绿**：

      ```sh
      pnpm typecheck   # host + client 双 tsc program
      pnpm build       # tsc × 2 → tsdown 打 lib/client.js
      pnpm verify      # 离线冒烟（manifest/exports/patch/产物形状 + 纯逻辑）
      ```

- [ ] **README 与实际分发形态一致**（skill §9）：README.md（英文）+ README.zh.md（中文）
      互相链接、内容一致；安装命令与即将发布的方式匹配——若先走 GitHub 分发，
      README 的推荐命令应为 `github:<owner>/dsh-conversation-outline`；
      npm 发布后再把推荐命令换成 npm 包名（两份 README 同步改）。
- [ ] **`lib/` 产物是最新且已提交**（本仓库策略，见 §6.2）——GitHub 安装拿到的就是
      仓库里的 `lib/`，发 tag 前必须确认与源码同步。
- [ ] **LICENSE 版权人已替换**（§1.3）。
- [ ] **`prepublishOnly` 存在**：`pnpm build && pnpm verify`——保证无论谁发布，
      发出去的必然是「构建 + 校验通过」的产物。
- [ ] **peer 依赖范围用 rc 通道**：`@deepseek-ai/*` 为 `^0.1.0-rc.6` 这类 rc 范围
      （普通 `^0.0.1` 不匹配 `0.0.1-rc.x`，安装会解析失败）。
- [ ] **敏感信息零残留**：`lib/` 内无本机绝对路径（`scripts/verify.mjs` 已自动检查
      `/Users/`），`.gitignore` 排除 `node_modules/`（开发期类型符号链接绝不入库）。

---

## 3. 创建 GitHub 仓库（Create the Repo）

本仓库目前**尚未 `git init`**，首次发布从这里开始。

### 3.1 命令行（gh CLI）

```sh
gh auth login                    # 首次：浏览器授权
git init
git add -A
git commit -m "chore: initial commit"
gh repo create <owner>/dsh-conversation-outline --public --source . --remote origin --push
```

`gh repo create` 文档：<https://cli.github.com/manual/gh_repo_create>。

### 3.2 Web 界面

打开 <https://github.com/new>：

- Repository name：`dsh-conversation-outline`（与包名一致，便于 `github:owner/repo` 记忆）。
- Visibility：**Public**（私有仓库无法被 `dsh plugin add github:...` 直接安装）。
- Description：`Codex-style conversation outline plugin for DeepSeek Harness (bilingual zh-CN/en)`。
- 不要勾选自动初始化（README/LICENSE/.gitignore）——仓库里已有，避免冲突；
  若误勾，用 `git pull --rebase` 合并。

参考：<https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository>

### 3.3 初始化建议（可选但推荐）

- **Topics**：`dsh`、`dsh-plugin`、`deepseek-harness`、`conversation-outline`——便于被发现。
- **默认分支保护**：Settings → Branches → main：要求 PR 通过（typecheck/build/verify）才能合并。
- **ISSUE_TEMPLATE / PR template**（可选）：`.github/ISSUE_TEMPLATE/bug_report.yml`、
  `.github/pull_request_template.md`。
- **SECURITY.md**（可选）：说明漏洞上报渠道（GitHub private advisory 即可）。

---

## 4. 版本与 Release 工作流（Versioning & Releases）

### 4.1 语义化版本（SemVer）

起步 `0.1.0`。规则：

- `patch`：修复、文案、样式微调（`0.1.1`）；
- `minor`：新功能、向后兼容增强（`0.2.0`；`0.x` 阶段 minor 可以是任何功能）；
- `major`：破坏性变更（`1.0.0` 之后才严格适用，`0.x` 阶段破坏性变更 bump minor 即可）。

### 4.2 CHANGELOG

推荐 `CHANGELOG.md` 手写（项目小，避免引入 Changesets 的复杂度）：

```markdown
## [0.1.0] - 2026-01-xx

### Added
- 浮动徽章 + 会话大纲面板（shell.overlay）
- 点击跳转（切 Chat 视图 → 滚动 → 高亮闪烁）
- 搜索 / 加载更早 / 复制 / 追问标签
- zh-CN / en 双语
```

### 4.3 发版动作

```sh
pnpm typecheck && pnpm build && pnpm verify   # 全绿
# 更新 version（npm version 0.1.1 或手改 package.json）
git add -A && git commit -m "release: v0.1.1"  # lib/ 变更一并提交（§6.2）
git tag v0.1.1
git push origin main --tags
gh release create v0.1.1 --generate-notes     # GitHub Release + 自动生成变更说明
```

`gh release create` 文档：<https://cli.github.com/manual/gh_release_create>；
GitHub Releases 说明：<https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository>

### 4.4 可选：CI（GitHub Actions）

`.github/workflows/ci.yml` —— PR 自动检查：

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm verify
```

> 注意：CI 里 `pnpm install` 需要能解析 `@deepseek-ai/*` peer（本仓库通过
> `pnpm dev:types` 符号链接本地类型，见 implementation-spec §1.7）——若 CI 无 DSH
> checkout，可让 CI 先执行 `pnpm dev:types` 对应的链接脚本，或在 CI 里跳过类型检查、
> 仅跑 `pnpm build && pnpm verify`。以实际 CI 环境为准。

发布自动化的可选进阶：`on: push: tags: ['v*']` 触发 `pnpm publish`，配合
[npm trusted publishing（OIDC）](https://docs.npmjs.com/generating-provenance-statements)
可免存 token、自动生成 provenance 签名。

---

## 5. npm 发布（npm Publish）

### 5.1 账号与安全前置

- 在 <https://www.npmjs.com> 注册账号，**必须开启 2FA**（npm 已强制：发布包的账号必须有
  2FA；GitHub 也在把 npm 账号的 2FA 与短时令牌作为安全基线推行）。
  参考：[npm Docs — Requiring 2FA for package publishing](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/)
  与 [GitHub Mandates 2FA and Short-Lived Tokens for npm](https://thehackernews.com/2025/09/github-mandates-2fa-and-short-lived.html)。
- 本地登录：`npm login`（或 `pnpm login`，二者共享 npm 凭证）。

### 5.2 发布命令

```sh
npm pack --dry-run   # 先看 files 白名单实际会打进哪些文件（应只有 lib/、assets、docs、patch、README、LICENSE）
pnpm publish         # 触发 prepublishOnly: pnpm build && pnpm verify
```

- `prepublishOnly` 保证发布前自动重构建 + 校验，防止手滑发布旧产物。
- 发布后验证：`npm view dsh-conversation-outline`（版本、文件、peerDependencies）。
- 钉版本安装（用户侧）：`dsh plugin --profile web add dsh-conversation-outline@0.1.0`。

参考：<https://docs.npmjs.com/cli/v10/commands/npm-publish>

### 5.3 命名冲突与 scoped 兜底（Fallback）

若 `dsh-conversation-outline` 已被占用（`npm view` 返回包信息而非 404）：

1. 改用 scoped 名：`@<你的npm用户名>/dsh-conversation-outline`（scope 名可以是用户名或组织名；
   npm 每个账号默认拥有同名 scope）。
2. **scoped 包发布默认是 `restricted`（私有）**，必须显式声明公开：

   ```jsonc
   // package.json
   {
     "name": "@<your-username>/dsh-conversation-outline",
     "publishConfig": { "access": "public" }
   }
   ```

   （`access: public` 只对首次发布生效；`npm publish --access public` 是等价的一次性参数。）
3. 同步更新：README 安装命令、`exports` 不变（包名不影响内部路径）、`cordis.patch.yml`
   的 `id`/`name` 改为新包名（verify 脚本会检查 patch 首行 id/name 与 `package.json.name`
   一致，改名后必须重跑 `pnpm verify`）。
4. 重新走一遍 §2 清单后发布。

> **不要用 `@deepseek-ai` scope**：那是 DSH 官方 registry 的私有 scope（需要官方只读
> token），个人无法发布。scoped 兜底只建议用你自己的用户名/组织 scope。

---

## 6. GitHub-only 分发（本仓库默认形态）

### 6.1 关键决策：`lib/` 提交进 Git

skill §7.1 给出 Git 分发的两种构建策略，本仓库选的是**备选（无交互安装）**：

> 把 exports 指向的完整、最新 `lib/` 提交进 Git；用户无需执行依赖脚本。

- `.gitignore` **故意不忽略 `lib/`**（当前只忽略 `node_modules/`、`*.tsbuildinfo`、
  `.DS_Store`、`*.log`、`.tmp/`）。
- 因此 `dsh plugin --profile web add github:<owner>/dsh-conversation-outline` 拿到的是
  **已构建产物**，直接可加载：
  - 不需要 `prepare` 构建脚本；
  - 不需要在用户 profile 的 `pnpm-workspace.yaml` 里配 `allowBuilds`；
  - 不需要执行任何第三方代码 → 安装零交互、零安全门禁。
- 代价：每次发版必须**把最新的 `lib/` 一起提交**（见 §4.3），否则 GitHub 安装拿到的是
  过期产物。`scripts/verify.mjs` 会在本地兜底检查产物一致性，但「提交时产物最新」是
  发布纪律，无法自动保证。

### 6.2 维护者纪律（GitHub 分发专属）

每次发版动作固定为：

```sh
pnpm build && pnpm verify   # 产物重建 + 校验
git add -A && git commit -m "release: v0.1.1 (rebuild lib)"  # lib/ 变更必须入库
git push origin main --tags
```

永远不要在 `lib/` 过期时打 tag。

### 6.3 备选路径（官方主推，供完整性参考）

如果将来想**不提交 lib/**（仓库更干净、产物不漂移），就走官方主推的 `prepare` 路线：

1. `package.json` 加：

   ```jsonc
   "scripts": { "prepare": "pnpm build" }
   ```

2. pnpm ≥10 默认**拦截 Git 依赖的构建脚本**（安全默认，见
   [pnpm/pnpm#10288](https://github.com/pnpm/pnpm/pull/10288) 与
   [pnpm 10.26 发布说明](https://pnpm.io/zh/blog/releases/10.26)），用户必须在**自己 profile
   的 `pnpm-workspace.yaml`** 里显式放行再重跑 `add`：

   ```yaml
   # <DSH_HOME>/<profile>/pnpm-workspace.yaml
   allowBuilds:
     dsh-conversation-outline: true   # 或按 pnpm 版本用 onlyBuiltDependencies
   ```

3. 安全注意：`prepare` 会在安装时执行第三方代码，用户侧务必**固定 commit**
   （`github:owner/repo#<sha>`）且只信任已审查的仓库。

### 6.4 两种策略对比

| 维度 | lib 入库（本仓库现状） | prepare + allowBuilds |
|---|---|---|
| 用户安装复杂度 | 零（装完即用） | 需手改 profile 配置后重装 |
| 仓库整洁度 | lib/ 与源码并存 | 仓库只有源码 |
| 产物漂移风险 | 需发布纪律（§6.2） | 安装时现构建，无漂移 |
| 第三方代码执行 | 无 | 有（需 allowBuilds 门禁） |
| 推荐度 | 本项目采用 | 官方主推，大型/多人项目适用 |

---

## 7. 发布后推广（Post-publish Promotion）

1. **README badges 换回动态**：npm 发布前徽章用静态形式（`badge/npm-v0.1.0` /
   `badge/license-MIT`，避免 "package not found"）。**发布成功后**，把两份 README 顶部
   换回动态徽章，自动显示真实版本与下载量：

   ```markdown
   [![npm](https://img.shields.io/npm/v/dsh-conversation-outline.svg)](https://www.npmjs.com/package/dsh-conversation-outline)
   [![npm downloads](https://img.shields.io/npm/dm/dsh-conversation-outline.svg)](https://www.npmjs.com/package/dsh-conversation-outline)
   [![license](https://img.shields.io/npm/l/dsh-conversation-outline.svg)](LICENSE)
   ```

   （每次升版本后静态 `npm-vX.Y.Z` 徽章也要同步更新，动态徽章则不用管。）
2. **README 安装命令切换**：把推荐安装方式从 `github:<owner>/...`（或 `link:`）换成
   `dsh plugin --profile web add dsh-conversation-outline`（npm 形态），GitHub 方式保留为
   「用最新提交」的备选。
3. **截图**：补上 `assets/ui.png` 面板截图（README 预览区已留占位）。
4. **对外渠道**（可选）：DSH 生态列表 / 社区帖 / 博客介绍。

---

## 8. FAQ

**Q1：npm 包名被占了怎么办？**
→ 见 §5.3：改 scoped 名 `@<你的用户名>/dsh-conversation-outline` + `publishConfig.access:
public`，同步改 `cordis.patch.yml` 的 id/name 并重跑 `pnpm verify`。

**Q2：GitHub 安装会不会执行构建脚本 / 需要 allowBuilds 吗？**
→ 当前不会：`lib/` 已入库，无需 `prepare`。**只有**改走 §6.3 的 prepare 路线后，用户才需要
在 profile 的 `pnpm-workspace.yaml` 配 `allowBuilds` 并重跑 `add`。

**Q3：用户怎么升级？**
→ 同一条 add 命令重跑即可：`dsh plugin --profile web add dsh-conversation-outline`（npm）
或 `...@0.1.1` 钉版本；GitHub 方式 `add github:<owner>/dsh-conversation-outline` 拉最新
main。升级后重启 DSH 服务。

**Q4：怎么卸载？**
→ `dsh plugin --profile web remove dsh-conversation-outline`（以 `dsh plugin --help`
确认子命令名；skill 明确给出的是 `add`/`list`）。

**Q5：发错了版本能撤回吗？**
→ npm 只允许在发布后 **72 小时内** unpublish（`npm unpublish`），之后只能
`npm deprecate`。所以小版本宁可多发 patch，也不要轻易撤包；GitHub tag 可随时删除重建。

**Q6：用户装的是最新版，但国内镜像没同步？**
→ 镜像缓存 `latest` 有延迟，用户钉版本安装（§5.2）即可绕开。

**Q7：用户报 `waiting for service: xxx` 或 peer 解析失败？**
→ 版本通道不匹配：`@deepseek-ai/*` 的 peer 范围必须是 rc 通道（本项目 `^0.1.0-rc.6`），
且用户侧 `dsh` CLI 与 bundle 版本要同通道。见 implementation-spec §1.6 与开发指南 §4.3。

**Q8：GitHub-only 分发还需要 npm 账号吗？**
→ 不需要。GitHub 分发对发布者和用户都无需 npm 登录；npm 发布仅在你选择走 §5 时才有前置要求
（2FA 等）。

**Q9：`lib/` 能不能加回 `.gitignore`？**
→ 可以，但那就等于切到 §6.3 的 prepare 路线：必须同步加 `prepare` 脚本、更新 README
（告诉用户配 `allowBuilds`）。改之前想清楚——当前「lib 入库」是 GitHub 零交互安装的前提。

---

## 9. 参考

- DSH 插件开发 Skill §7/§8（本机权威）：`/tmp/dsh-plugin-skill.md`
- 开发长文指南 §4（构建与安装）：`/tmp/developing-dsh-plugins.md`
- 官方参考插件（MIT，已发布 npm）：`@nanmicoder/dsh-agent-teams`
- [npm Docs — npm-publish](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [npm Docs — Requiring 2FA for package publishing](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/)
- [GitHub Mandates 2FA and Short-Lived Tokens for npm (The Hacker News, 2025-09)](https://thehackernews.com/2025/09/github-mandates-2fa-and-short-lived.html)
- [pnpm/pnpm#10288 — block git dependencies from running prepare scripts unless allowed](https://github.com/pnpm/pnpm/pull/10288)
- [pnpm 10.26 release notes](https://pnpm.io/zh/blog/releases/10.26)
- [GitHub Docs — Creating a new repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
- [GitHub Docs — Managing releases in a repository](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
- [gh CLI — gh repo create](https://cli.github.com/manual/gh_repo_create)
- [npm Docs — Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements)
