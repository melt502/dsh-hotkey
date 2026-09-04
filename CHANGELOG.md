# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Approval card detection updated for DSH 2.0.5 / `dsh-client-ui-approval`
  (0.1.2-rc.1). The approval panel moved to a dedicated package with the stable
  attribute `[data-approval-key]` and new button labels ("允许一次" / "Allow
  once"). The old `[class*="Mbwy4a_card"]` selector is kept as a fallback for
  older DSH builds, so both layouts work.
- Composer filtering now also excludes `[data-approval-key]` containers, so the
  approval textarea is never picked up as the main chat composer.
- **`data-pane` removed in DSH 2.0.5**: the layout package replaced
  `[data-pane="sidebar"]` with `[data-side="sidebar"]`. Every DOM-fallback
  selector now uses a combined query `[data-side="sidebar"] …, [data-pane="sidebar"] …`
  so the old and new layouts both work. This was silently breaking sidebar
  toggle, new workspace, and new session in the new DSH.
- `peerDependencies` for `@deepseek-ai/dsh-client-locale` now spell out each
  prerelease branch explicitly. A plain `>=0.1.0-rc.6` range silently rejects
  every prerelease whose `major.minor.patch` tuple differs from `0.1.0` — which
  includes the `0.1.1-rc.*` builds the harness actually ships — because
  node-semver only admits a prerelease when some comparator carries a prerelease
  tag on the *same* tuple. Installs could fail with `ERESOLVE`.

### Added

- `Ctrl+Alt+V` toggles the `dsh-vision-router` Vision mode button in the composer.
- README now documents prerequisite plugins (`dsh-vision-router` / `dsh-better-sidebar`) and marks each shortcut's dependency in the keybinding table.
- `.gitattributes` normalising committed line endings to LF.
- `.editorconfig` recording the tab-indent / LF conventions.
- GitHub Actions workflow running the four test suites on Node 20, 22 and 24.
- Per-suite npm scripts (`test:core`, `test:harness`, `test:bundle`, `test:dom`)
  and `npm run check` for a syntax-only pass over the browser bundle.

## [0.1.0] - 2026-08-25

Initial release: 19 actions, 15 bound by default.

### Added

- **Layout**: toggle the left sidebar (`Ctrl+B`), the right sidebar
  (`Ctrl+Alt+B`), and the bottom panel (`Ctrl+J`).
- **Right-sidebar tabs**: files (`Ctrl+Shift+E`), Git (`Ctrl+Shift+G`),
  terminal (`` Ctrl+` ``), and Side Chat (`Alt+E`). `Alt+E` expands a collapsed
  right sidebar first, then opens or creates the chat, retrying until React has
  committed the panel.
- **Right-sidebar keyboard navigation**: `↑` / `↓` cycle the focusable buttons
  inside the right sidebar and `Enter` activates the selected one. Inactive
  while the sidebar is collapsed, while a text field holds focus, and during IME
  composition.
- **Sessions and workspaces**: new session (`Ctrl+N`), new workspace
  (`Ctrl+F`), previous / next session (`Ctrl+[` / `Ctrl+]`).
- **Approvals**: `Enter` approves and `Esc` declines while an approval card is
  visible; both keys fall through untouched otherwise.
- **Misc**: focus the composer (`Ctrl+I`), open settings (`Ctrl+,`).
- **Settings page** under system settings → keyboard shortcuts: record-style
  rebinding, per-action reset, reset-all, a master enable switch, conflict
  badges, and JSON import / export.
- **Persistence** through the DSH settings service under the `hotkey`
  namespace.
- **Bilingual UI** (Chinese / English) following the host locale.
- **Layered fallbacks**: every action prefers a service API and falls back to a
  DOM path, so a service that is not yet provided at activation time does not
  disable the binding. An action reports success only when it actually did
  something, and only then is the key event consumed.
- **Diagnostics** on `window.__DSH_HOTKEY__`: `probe()`, `readiness()`,
  `availability()`, `effective()`, and `debug(true)`.

[Unreleased]: https://github.com/melt502/dsh-hotkey/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/melt502/dsh-hotkey/releases/tag/v0.1.0
