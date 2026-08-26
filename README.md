# dsh-hotkey

[![DSH Desktop](https://img.shields.io/badge/DSH-Desktop-3b82f6)](https://github.com/deepseek-ai/DeepSeek-Harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Configurable VS Code style keyboard shortcuts for the **DSH Desktop web GUI**, with a settings-page keybinding editor, conflict detection and JSON import/export.

为 **DSH Desktop Web GUI** 提供可配置、VS Code / Codex 风格的键盘快捷键，并在设置页内直接改键。

[English](#english) · [中文](#中文)

---

## English

`dsh-hotkey` adds keyboard entry points for common workbench operations and a visual keybinding editor under **Settings → Keyboard shortcuts**. Every action resolves through a service API first and falls back to DOM interaction, because DSH client plugins register their services asynchronously and a service may not exist yet when the hotkey plugin activates.

**Requirement:** the right-sidebar actions (terminal, files, Git, Side Chat, bottom panel) target `dsh-better-sidebar`. Without it those actions stay unavailable; the rest still work.

### Features

- 19 actions, 15 bound by default
- Rebind, disable, reset one or reset all under **Settings → Keyboard shortcuts**
- Conflict detection; on conflict the earlier action in the table wins
- JSON import/export of the whole keymap
- Persisted to the DSH settings scope (namespace `hotkey`)
- Follows the DSH interface language (Chinese / English)
- Right-sidebar keyboard navigation: `↑` / `↓` move between visible buttons, `Enter` clicks
- Two-stage Side Chat: `Alt+E` expands the right sidebar first, then opens or creates the chat
- Vision mode toggle: `Ctrl+Alt+V` clicks the `dsh-vision-router` composer button to switch Vision mode on or off
- Service-first with DOM fallback, so a late-registering service does not disable the shortcut

### Default keybindings

| Keys | Action | Notes |
| --- | --- | --- |
| `Ctrl+B` | Toggle left sidebar | Session / workspace column |
| ``Ctrl+` `` | Open / focus terminal | Right-side terminal tab |
| `Ctrl+J` | Toggle bottom panel | Bottom terminal / panel |
| `Ctrl+Alt+B` | Toggle right sidebar | Side card hosting Files, Git, Side Chat |
| `Ctrl+Shift+E` | Files / editor | Opens the Files tab |
| `Ctrl+Shift+G` | Git panel | Opens the source-control tab |
| `Alt+E` | Side Chat | Expands the right sidebar, then opens the chat |
| `Ctrl+Alt+V` | Toggle Vision mode | Clicks the `dsh-vision-router` button |
| `Ctrl+F` | Open new workspace | Opens the "Add workspace" picker |
| `Ctrl+N` | New session | New session in the current workspace |
| `Enter` | Approve | Only while an approval card is visible |
| `Esc` | Decline | Only while an approval card is visible |
| `Ctrl+[` | Previous session | Session list navigation |
| `Ctrl+]` | Next session | Session list navigation |
| `Ctrl+I` | Focus composer | Caret moves to the end |
| `Ctrl+,` | Open settings | DSH settings entry |

Four more actions ship unbound: right details column, subagent panel, system terminal window, command menu.

`Enter` / `Esc` are only intercepted while an approval card is visible; otherwise DSH keeps its native behaviour.

### Install

From a local checkout:

```powershell
dsh plugin --profile web add "link:<absolute path to this repo>"
```

Restart DSH Desktop after adding the bundle. During development, edits to `lib/client.js` reach the running GUI on refresh; hot replacement without a refresh additionally requires the `pnpm run dev:web` watcher from the same DSH checkout.

If the profile's pnpm resolution is blocked by a minimum-release-age policy, link `node_modules/dsh-hotkey` to this repository manually and add `dsh-hotkey` to both `dependencies` and `dsh.profile.bundles` in the web profile's `package.json`.

### Configure

Open **Settings → Keyboard shortcuts**:

- Press *Change*, then type the new combination
- `Esc` cancels recording
- `Delete` / `Backspace` disables the action
- Reset a single binding or all of them
- Export the current keymap as JSON, edit, import back

### Runtime diagnostics

In the DSH web DevTools console:

```js
window.__DSH_HOTKEY__.effective()    // active keymap
window.__DSH_HOTKEY__.availability() // per-action availability shown in settings
window.__DSH_HOTKEY__.probe()        // services, DOM, tabs, sessions, panels
window.__DSH_HOTKEY__.readiness()    // handler readiness
window.__DSH_HOTKEY__.debug(true)    // per-key debug logging
```

### Test

No dev dependencies; the suites use only Node.js built-ins.

```powershell
npm test
```

Or individually:

```powershell
node test\bindings.test.mjs   # pure core logic + core/client drift guard
node test\harness.cjs         # ModuleLoader factory and apply() activation
node test\verify-bundle.cjs   # package / patch / bundle structure checks
node test\dom.test.mjs        # fake-DOM integration and action checks
```

Run the files directly rather than `node --test test/`, which can fail under restrictive Windows sandboxes.

### Compatibility

- Target: DSH Desktop web profile
- DOM fallbacks depend on the current DSH / better-sidebar DOM contract; re-run the suites and verify in a live page after a DSH UI upgrade
- Avoid binding combinations the browser or Electron reserves (`Ctrl+W`, `Ctrl+R`, `F11`)

---

## 中文

`dsh-hotkey` 为常用工作台操作增加键盘入口，并在 **系统设置 → 快捷键** 中提供可视化改键、禁用、冲突检测及 JSON 导入/导出。由于 DSH 客户端插件的服务是异步注册的，插件激活时服务可能尚不存在，因此每个动作都采用「服务 API 优先、DOM 兜底」的策略。

**前置条件：** 右侧边栏相关动作（终端、文件、Git、侧边对话、底部面板）依赖 `dsh-better-sidebar`。未安装时这些动作不可用，其余动作仍可正常工作。

### 功能

- 19 个动作，15 个默认键位
- 在 **系统设置 → 快捷键** 中改键、禁用、单条恢复默认、全部恢复默认
- 组合键冲突检测；冲突时按动作表顺序确定优先级
- JSON 导入 / 导出完整键位表
- 持久化到 DSH settings scope（命名空间 `hotkey`）
- 跟随 DSH 界面语言（中文 / 英文）
- 右侧边栏键盘导航：`↑` / `↓` 在可见按钮间移动，`Enter` 模拟点击
- Side Chat 两阶段打开：`Alt+E` 先展开右侧边栏，再打开或新建对话
- 服务与 DOM 双路径，避免服务延迟注册导致快捷键完全失效

### 默认快捷键

| 快捷键 | 动作 | 说明 |
| --- | --- | --- |
| `Ctrl+B` | 切换左侧边栏 | 会话 / 工作区栏 |
| ``Ctrl+` `` | 打开 / 聚焦终端 | 右侧终端标签 |
| `Ctrl+J` | 切换底部面板 | 底部终端 / 面板 |
| `Ctrl+Alt+B` | 切换右侧边栏 | 承载文件、Git、侧边对话的侧边卡片 |
| `Ctrl+Shift+E` | 文件树 / 编辑器 | 打开文件标签 |
| `Ctrl+Shift+G` | Git 面板 | 打开源代码管理标签 |
| `Alt+E` | 侧边对话 | 先展开右侧边栏，再打开对话 |
| `Ctrl+Alt+V` | 切换识图模式 | 点击 `dsh-vision-router` 右下角识图按钮 |
| `Ctrl+F` | 打开新的工作区 | 打开「添加工作区」选择器 |
| `Ctrl+N` | 新建会话 | 在当前工作区新建会话 |
| `Enter` | 同意审批 | 仅审批卡片可见时接管 |
| `Esc` | 拒绝审批 | 仅审批卡片可见时接管 |
| `Ctrl+[` | 上一个会话 | 会话列表导航 |
| `Ctrl+]` | 下一个会话 | 会话列表导航 |
| `Ctrl+I` | 聚焦输入框 | 光标移至末尾 |
| `Ctrl+,` | 打开系统设置 | DSH 设置入口 |

另有 4 个动作默认不分配键位：右侧详情列、子代理面板、系统终端窗口、命令菜单。

`Enter` / `Esc` 只在审批卡片可见时拦截，其他情况保持 DSH 原生行为。

### 安装

从本地目录安装：

```powershell
dsh plugin --profile web add "link:<本仓库绝对路径>"
```

新增 bundle 后需重启 DSH Desktop。开发期间修改 `lib/client.js` 刷新页面即生效；若要免刷新热替换，还需同一 DSH checkout 下运行 `pnpm run dev:web` watcher。

若 profile 的 pnpm 解析被最小发布时间策略阻止，可手动把 `node_modules/dsh-hotkey` 链接到本仓库，并把 `dsh-hotkey` 同时加入 web profile `package.json` 的 `dependencies` 与 `dsh.profile.bundles`。

### 配置

进入 **系统设置 → 快捷键**：

- 点击「修改」后直接按下新组合键
- `Esc` 取消录制
- `Delete` / `Backspace` 禁用该动作
- 单条恢复默认或全部恢复默认
- 导出当前 JSON 配置，编辑后重新导入

### 运行时诊断

在 DSH Web DevTools Console 中：

```js
window.__DSH_HOTKEY__.effective()    // 当前生效键位表
window.__DSH_HOTKEY__.availability() // 设置页可用性判定
window.__DSH_HOTKEY__.probe()        // 服务、DOM、标签、会话、面板诊断
window.__DSH_HOTKEY__.readiness()    // handler 就绪信息
window.__DSH_HOTKEY__.debug(true)    // 逐键调试日志
```

### 测试

无需开发依赖，测试仅使用 Node.js 内置模块。

```powershell
npm test
```

或单独运行：

```powershell
node test\bindings.test.mjs   # 纯核心逻辑 + core/client 漂移检查
node test\harness.cjs         # ModuleLoader factory 与 apply() 激活
node test\verify-bundle.cjs   # package / patch / bundle 结构检查
node test\dom.test.mjs        # 模拟 DOM 集成与动作检查
```

请直接运行测试文件，不要用 `node --test test/`：在受限的 Windows 沙箱下可能因子进程限制失败。

### 兼容性与限制

- 目标平台：DSH Desktop web profile
- DOM 兜底依赖当前 DSH / better-sidebar 的 DOM 契约；DSH UI 升级后应重新跑测试并在真实页面验证
- 不建议绑定浏览器或 Electron 已保留的组合键（`Ctrl+W`、`Ctrl+R`、`F11`）

## 项目结构 / Structure

```text
dsh-hotkey/
├── cordis.patch.yml       # DSH bundle loader patch
├── package.json           # bundle / client contract
├── lib/
│   ├── index.js           # node half (bundle entry)
│   ├── core.mjs           # combo parsing, matching, conflicts
│   └── client.js          # browser bundle: actions, settings page, keydown
├── test/
│   ├── bindings.test.mjs
│   ├── harness.cjs
│   ├── verify-bundle.cjs
│   └── dom.test.mjs
└── tools/                 # DOM contract inspection scripts
```

## License

[MIT](LICENSE)
