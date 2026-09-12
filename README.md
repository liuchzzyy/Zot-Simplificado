# Zot Simplificado（卜式）

为 Zotero 添加自定义列、Info 面板行和沉浸式双语阅读：

- **条目 ID（Item Key）**：显示条目的内部标识，只读
- **简记（Short Note）**：可在 Info 面板直接编辑，保存在条目的 `extra` 字段
- **翻译标题（Translated Title）**：可在 Info 面板直接编辑，保存在条目的 `extra` 字段
- **沉浸式双语对照**：在 Zotero 10 阅读模式中显示段落译文

界面文字跟随 Zotero 界面语言（简体中文 / English）。

---

## 安装

1. 下载最新的 `.xpi` 文件（见 [Releases](https://github.com/liuchzzyy/Zot-Simplificado/releases)）
2. 打开 Zotero，进入 **工具 → 插件**
3. 将 `.xpi` 拖入插件窗口
4. 重启 Zotero

## 使用

### 条目 ID / 简记 / 翻译标题

- 在主库视图点击条目列表右上角的列选择器
- 勾选「条目 ID」「简记」和/或「翻译标题」
- 在 Info 面板中点击「简记」或「翻译标题」即可编辑，失焦自动保存

### 沉浸式双语对照

1. 打开 PDF 或快照阅读器，先点击 **阅读模式**
2. 再点击工具栏中的 **双语** 开始翻译
3. 关闭阅读模式会自动结束双语并移除译文
4. 点击齿轮按钮可设置翻译引擎、语言、API、缓存和并发请求数

默认使用 Google 翻译。使用 OpenAI 兼容 API 时，填写 Base URL 和 API Key，点击「读取模型列表」后选择模型。缓存条数和并发请求数留空时，默认分别为 300 和 2。

双语按钮适配 Zotero 主题：浅色主题开启为蓝色，暗色主题开启为青绿色，关闭时恢复 Zotero 原生工具栏背景。

## 自动更新

插件会通过 GitHub Release 检查新版本。当前版本为 `1.2.0`，安装包名称为 `zot-simplificado-1.2.0.xpi`。

## 兼容性

- 条目列和 Info 面板：Zotero **7.0.0 – 10.0.***
- 沉浸式双语对照：Zotero **10.0.0+**

## 许可证

[MIT](LICENSE)
