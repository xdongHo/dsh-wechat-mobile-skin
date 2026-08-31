# 提交到 awesome-dsh-plugin 收录列表

本插件按 [awesome-dsh-plugin contributing.md](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md) 的规范准备投稿材料。

## 一、投稿是什么

**一个 YAML 文件就是全部投稿**：向 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 仓库开 PR，新增
`data/plugins/<owner>__<repo>.yml`（`<owner>` 换成你的 GitHub 用户名）。两个 README 由脚本生成，**不要手工编辑它们**。

条目内容（分类必须选 `theme`——皮肤类会被自动收进 dsh-market 的"主题 Tab"）：

```yaml
url: https://github.com/<owner>/dsh-wechat-mobile-skin
name: <owner>/dsh-wechat-mobile-skin
category: theme
description:
  en: 'WeChat-style mobile skin for the DeepSeek Harness Web GUI: mobile browsers get a WeChat chat list and chat page, desktop stays untouched.'
  zh: 'DeepSeek Harness 移动端微信风格皮肤：手机浏览器自动切换微信聊天列表与聊天页，桌面端保持不变。'
```

要点（来自规范）：

- 只有 `description.en` 必填；描述**以句号结尾、只说功能、不得夸大**（会对照代码核验）
- 描述含 `: `（冒号+空格）必须加引号
- 一个 PR 最多 3 条；只动自己这一个条目文件

## 二、提交前检查清单（CI 会自动核验）

| 要求 | 现状 |
|---|---|
| `package.json` 声明 `dsh.bundle` manifest | ✅ `dsh.bundle.patch: ./cordis.patch.yml`（仅声明 `dsh.client` 会被拒） |
| 真实可用代码，非占位仓库 | ✅ 完整 host 半 + 皮肤资源 |
| 仓库创建满 **1 天**、提交数 ≥ **10** | 推送到 GitHub 后计时满 1 天再开 PR；本仓库已含 10 个按真实开发轨迹划分的提交 |
| 仓库添加 `dsh-plugin` topic | ⬜ 推送后在 GitHub 仓库页 → About → Topics 添加 |
| 活跃维护 | 持续响应 issue / 更新 |

## 三、操作步骤

1. 在 GitHub 创建空仓库 `dsh-wechat-mobile-skin`（不要初始化 README）。
2. 推送本仓库：

   ```sh
   cd dsh-wechat-mobile-skin
   git remote add origin https://github.com/<owner>/dsh-wechat-mobile-skin.git
   git push -u origin main
   ```

3. 仓库页添加 topic：`dsh-plugin`（可再加 `deepseek` `wechat` `mobile`）。
4. **等仓库满 1 天**。
5. Fork [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，在 fork 中新增
   `data/plugins/<owner>__dsh-wechat-mobile-skin.yml`（内容见上），向其 `main` 开 PR。
6. CI 通过 + 维护者阅读源码后合并；合并后列表与网站自动重建。

## 四、可选增强

- **发布 npm**：市场展示下载量；发布前必须把本包 `package.json` 的 `repository` 字段指向上面
  的 GitHub 仓库，否则不会与列表条目关联（映射自动采集，条目里不写 `npm:` 字段）。
- **不发 npm**：可在 GitHub Release 附 `.tgz` 预构建包，并在条目加可选
  `tarball: https://github.com/<owner>/dsh-wechat-mobile-skin/releases/latest/download/dsh-wechat-mobile-skin.tgz`
  （资产名**不要带版本号**，否则下次发版即 404）。
- **截图**：本仓库已声明 `screenshots.json`（指向 `docs/` 下两张实拍图），市场详情页会展示；
  更新截图只需推自己的仓库。

## 五、本插件与规范的对应说明

- 未声明任何 `@deepseek-ai/*` 依赖（零依赖实现），因此**无需** `peerDependencies`，
  自然规避了 prerelease semver 陷阱（规范明确警告的 `ERESOLVE` 问题）。
- `dsh.client` 字段未声明：本插件的浏览器侧行为通过 Host 半的 `webServer.tapIndex` 注入，
  不走 client-modules 体系，故无需该字段。
- 入口 manifest 完整形态：`dsh.bundle.patch` + 根目录 `cordis.patch.yml`（含 `- insert:` 行）。
