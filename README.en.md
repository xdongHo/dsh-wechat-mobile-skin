# dsh-wechat-mobile-skin

A WeChat-style mobile skin for the DeepSeek Harness Web GUI. When a mobile
browser opens the GUI, it automatically switches to a WeChat-like chat
experience — fixing mobile layout problems. Desktop browsers are completely
unaffected.

> Author: **侯晓东 (Hou Xiaodong)** · License: MIT · Requires: `@deepseek-ai/dsh` (Web GUI)

## Features

**📱 Chat list — history sessions rendered like WeChat contacts**

- Colored rounded-square avatar from the session title's first character
- Session title, relative time (synced with the app), a green dot for ongoing sessions
- Workspace names as gray section headers (tap to collapse/expand)
- WeChat-style search bar filtering sessions in real time
- Top-right `+` starts a new session

**💬 Chat page — WeChat conversation style**

- Nav bar with a back button (hardware/gesture back also works), centered
  title, and an ongoing indicator
- User messages: WeChat-green bubbles (`#95EC69`), right-aligned, with timestamps
- Assistant messages: white bubbles, left-aligned — bubble colors alone tell
  the two sides apart, no avatars in the way
- Thinking blocks render as light-gray sub-cards
- Tool calls render as compact rows; context injections render as
  centered gray system notices
- White rounded composer with a green send button
- Auto-expands the sidebar's collapsed session list so every session shows
- Fullscreen toggle in both top bars (Fullscreen API; iOS falls back to an Add-to-Home-Screen hint)
- Long-press a session for the native menu (rename / fork / archive), repositioned as a phone-friendly centered sheet
- Floating stats ball: a draggable WeChat-green ball showing the turn count; tap it for steps, LLM/tool time, first-token speed, cache hit rate and token usage
- The new-session screen is skinned too: WeChat gray background with a subtle hint, desktop hero artwork removed

**🔧 Engineering**

- Pre-paint UA sniffing (no FOUC); only mobile UAs activate the skin
- Safe-area support (`viewport-fit=cover`, `env(safe-area-inset-*)`)
- 16px+ inputs prevent iOS focus zoom; Android keyboard via
  `interactive-widget=resizes-content`
- Injected in memory via `webServer.tapIndex` — **no dist files are modified**;
   uninstalling the plugin fully restores the page

## Install

```powershell
# 1. Install into the web profile
dsh plugin --profile web add "C:\path\to\dsh-wechat-mobile-skin"

# 2. Append to %DSH_HOME%\profiles\web\cordis.patch.yml:
- insert:
    - id: wechat-mobile-skin
      name: dsh-wechat-mobile-skin

# 3. Restart dsh web
```

Or, after publishing to npm: `dsh plugin --profile web add dsh-wechat-mobile-skin`
and add `"dsh-wechat-mobile-skin"` to `dsh.profile.bundles` in the profile's
`package.json` (the package ships its own `cordis.patch.yml`).

## Config

| key | type | default | description |
|---|---|---|---|
| `enabled` | bool | `true` | master switch |
| `prefix` | string | `dsh-wechat-mobile-skin` | asset route prefix |
| `navTitle` | string | `DeepSeek` | chat-list nav bar title |
| `forceTablet` | bool | `true` | treat iPad desktop-mode UAs as mobile |

## How it works

1. **Host half** (`lib/index.js`): injects the `webServer` service; uses
   `tapIndex()` to inject the viewport upgrade, theme color, the inline UA
   sniffer and asset tags into every index.html response (in memory), and
   `register({kind:"prefix"})` to serve `skin.css` / `skin.js` same-origin.
2. **Skin layer** (`assets/`): plain DOM + CSS on top of the running React
   app. The chat list mirrors the sidebar session tree (`[role="tree"]`);
   tapping a row forwards the click to the real sidebar row so the app does
   the navigation. On narrow viewports the app collapses the sidebar (and
   stops rendering the tree); the skin re-expands it invisibly. Chat/list
   modes toggle via `dsh-wx wx-mode-list / wx-mode-chat` classes on `<html>`,
   and every style lives under the `dsh-wx` scope.

## License

[MIT](./LICENSE) © 2026 侯晓东 (Hou Xiaodong)
