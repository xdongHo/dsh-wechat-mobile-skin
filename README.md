# dsh-wechat-mobile-skin

**DeepSeek Harness 微信风格移动端皮肤** —— 手机浏览器打开 DeepSeek Harness 的 Web GUI 时，自动切换为微信聊天式交互，解决移动端排版问题。桌面浏览器完全不受影响。

> 作者 / Author: **侯晓东 (Hou Xiaodong)** · License: MIT · 适用: `@deepseek-ai/dsh` (Web GUI)

## 功能

**📱 会话列表 —— 历史会话展示成"微信好友"一样**

| 微信元素 | 皮肤实现 |
|---|---|
| 好友头像 | 会话标题首字 + 按标题哈希着色的圆角方块 |
| 好友昵称 | 会话标题（超长省略号） |
| 时间 | 会话相对时间（"5分钟"等，与应用同步） |
| 未读/状态点 | 会话进行中显示绿色小圆点 |
| 通讯录分组 | 工作区名称作为灰色分组标题（点按折叠/展开） |
| 顶部搜索 | 微信式搜索框，实时过滤会话 |
| 右上角 + | 新建会话 |

**💬 聊天页 —— 微信对话页风格**

- 顶栏：`‹` 返回列表（同样支持手机物理/手势返回键）、居中标题、进行中绿点
- 用户消息：微信绿气泡（`#95EC69`）右对齐 + 时间戳
- 助手消息：白色气泡左对齐；不同颜色的气泡区分对话双方，无头像干扰
- 思考过程为气泡内浅灰折叠卡
- 工具调用行紧凑展示；"上下文注入"等系统信息居中灰字（微信系统提示样式）
- 底部输入区：白底圆角输入框、绿色发送按钮
- 会话列表自动展开全部历史会话（不再只有最新几条）
- 顶栏全屏按钮：主动调用 Fullscreen API 进入沉浸式模式（iOS 不支持 API 时提示用「添加到主屏幕」）
- 长按会话（或点行尾 ⋯）弹出原生操作菜单（重命名 / 分叉会话 / 归档会话），已重定位为手机友好的居中样式；行内提示“轻触打开 · 长按管理”
- 会话统计悬浮球：绿色可拖动悬浮球显示轮数，点开查看步数、LLM/工具耗时、首 token 速度、缓存命中率、输入/输出 token
- 新建会话首屏同样皮肤化：微信灰底 + “开始新的会话”提示 + 底部输入条，原桌面端光晕/大标语不再出现

**🔧 工程细节**

- 首屏前 UA 探测（无闪烁），仅 `Android / iPhone / iPad / Mobile` 等移动端 UA 启用
- 刘海屏安全区适配（`viewport-fit=cover` + `env(safe-area-inset-*)`）
- 输入框字号 ≥16px，避免 iOS 聚焦自动放大；Android 键盘 `interactive-widget=resizes-content`
- 支持手机返回键（基于 History API）；应用会话流"加载更多"等原生命令不受影响
- **通过 `webServer.tapIndex` 内存注入，不修改任何 dist 文件**；卸载插件即完全还原

## 安装

### 方式一：本地目录安装（推荐，离线可用）

```powershell
# 1. 把本插件安装进 web profile
dsh plugin --profile web add "C:\path\to\dsh-wechat-mobile-skin"

# 2. 在 %DSH_HOME%\profiles\web\cordis.patch.yml 末尾追加：
- insert:
    - id: wechat-mobile-skin
      name: dsh-wechat-mobile-skin

# 3. 重启 dsh web，手机访问即生效
```

### 方式二：npm 安装（发布后）

```powershell
dsh plugin --profile web add dsh-wechat-mobile-skin
```

然后在 `package.json` 的 `dsh.profile.bundles` 中加入 `"dsh-wechat-mobile-skin"`（本包自带 `cordis.patch.yml`，bundles 方式无需手写 patch 行），重启 `dsh web`。

### 卸载

删除 `cordis.patch.yml` 中对应的 `insert` 行（及 bundles 条目），重启 `dsh web` 即可，页面完全还原。

## 配置

在 patch 行的 `config` 中可覆盖（均有默认值）：

| 键 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | bool | `true` | 总开关 |
| `prefix` | string | `dsh-wechat-mobile-skin` | 静态资源路由前缀 |
| `navTitle` | string | `DeepSeek` | 会话列表顶部标题 |
| `forceTablet` | bool | `true` | iPad 桌面模式 UA（Macintosh + 多点触控）也按移动端处理 |

## 截图

手机视口（390×844）实拍：

- [docs/screenshot-list.png](./docs/screenshot-list.png) — 会话列表（微信好友样式）
- [docs/screenshot-chat.png](./docs/screenshot-chat.png) — 聊天页（微信对话样式）

## 实现原理

1. **Host 半**（`lib/index.js`）：注入 `webServer` 服务，
   - `tapIndex()` 在每次 index.html 响应的 `<head>` 中内存注入 viewport 升级、`theme-color`、UA 探测内联脚本与皮肤资源引用；
   - `register({kind:"prefix"})` 以同源路由提供 `skin.css` / `skin.js`（按请求读盘，改完刷新即生效）。
2. **皮肤层**（`assets/`）：纯 DOM + CSS，不侵入 React 状态 ——
   - 会话列表是侧边栏会话树（`[role="tree"]`）的镜像覆盖层，点按行转发给真实侧边栏行完成导航；
   - 窄屏下应用会把侧边栏折叠成图标栏（不渲染会话树），皮肤自动展开它（该列本身被皮肤隐藏，用户无感）；
   - 聊天页通过对 `<html>` 的 `dsh-wx wx-mode-list / wx-mode-chat` 类切换视图，微信样式全部作用于 `dsh-wx` 作用域之下。

## 已知取舍

- 皮肤为微信浅色固定配色（移动端强制 light，桌面端深色偏好不受影响）
- 右下角小鲸鱼悬浮宠在手机上会遮挡输入区，移动端已隐藏
- 与其它直接改 `dist/index.html` 的做法互斥；本插件不改磁盘文件，可与 `dsh-glm-usage`、`whale-girl`、`dshmarket` 等共存

## 插件开发迭代提示

- pnpm 对 `file:` 依赖在 Windows 上做**硬链接/拷贝**：修改本包源码后，需在 profile 目录重新执行
  `pnpm install`（或重新 `dsh plugin add`），再重启 `dsh web` 才会生效。
- 静态资源 `skin.css` / `skin.js` 由 Host 按请求读盘返回（`cache-control: no-cache`），
  若安装形态为**链接**（非拷贝），改完刷新页面即可看到。

## 开源许可

[MIT](./LICENSE) © 2026 侯晓东 (Hou Xiaodong)。欢迎 Issue / PR。

English summary: see [README.en.md](./README.en.md).
