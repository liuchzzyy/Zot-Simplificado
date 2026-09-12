# Zot Simplificado

一个面向 Zotero 学术阅读场景的轻量插件，当前包含两组能力：

- 在条目列表和 Info 面板中显示、编辑 Item Key、简记和翻译标题。
- 在 Zotero 10 阅读模式中提供可见段落懒加载的沉浸式双语对照。

插件名称为 `Zot Simplificado`，中文名为「卜式」，版本为 `1.3.0`，插件 ID 为 `zot-simplificado@liuchzzyy`，运行时命名空间为 `ZotSimplificado`。

## 使用

### 条目元数据

在条目列表的列选择器中勾选「条目 ID」「简记」或「翻译标题」。在 Info 面板中编辑简记和翻译标题，内容分别以以下形式保存到条目的 `extra` 字段，并随 Zotero 同步：

```text
short-note: 我的备注
translated-title: 论文中文标题
```

### 沉浸式双语阅读

1. 用 Zotero 10 打开 PDF 或快照阅读器。
2. 点击阅读器工具栏的「阅读模式」，再点击「双语」。
3. 插件只请求当前视口附近的正文段落；向下滚动后继续加载。
4. 译文显示在原文下方，原文不会被修改。
5. 关闭阅读模式会自动关闭双语并移除当前译文。
6. 点击工具栏的齿轮按钮，可以选择 Provider、源语言、目标语言、模型、并发数和缓存上限。

双语按钮会自动适配 Zotero 主题：关闭时使用原生工具栏背景；浅色主题开启时使用 Zotero 蓝色；暗色主题开启时使用 Zotero 青绿色。

默认 Provider 是 Google 网页翻译接口，不需要 API Key，但可能受限流和接口变化影响。需要稳定配额时，可以选择 OpenAI 兼容 AI API，填写 Base URL 和 API Key，再点击「读取模型列表」从上游获取模型并在下拉框中选择，例如：

- `https://api.openai.com/v1`
- `https://api.deepseek.com/v1`
- `http://localhost:11434/v1`

缓存条数和并发请求数可以手动设置；留空时分别使用 300 和 2。

## 代码结构

```text
bootstrap.js                         插件生命周期和模块加载顺序
prefs.js                             默认偏好
content/core/runtime.js              配置、命名空间、日志和偏好访问
content/item-metadata.js              Item Key / Extra 字段列和 Info 行
content/translation/
  provider-registry.js                Provider 注册表
  providers/google.js                 Google Provider
  providers/openai-compatible.js      OpenAI 兼容 Provider
  translation-service.js              Provider 选择、请求队列和并发控制
  translation-cache.js                内存 + Zotero 偏好持久化缓存
content/reader/
  reader-window.js                    Reader iframe 和阅读模式定位
  block-collector.js                  可见正文块提取
  translation-renderer.js              译文节点、样式、失败重试
  bilingual-reader.js                  阅读器生命周期和模块编排
content/preferences.*                 设置页和设置页样式
```

### 添加新的翻译 Provider

新 Provider 只需要实现 `id`、`displayName` 和 `translate(context)`，然后在 `bootstrap.js` 的 `MODULES` 中、翻译服务加载之前加入模块路径：

```js
Zotero.ZotSimplificado.Translation.registerProvider({
  id: "my-provider",
  displayName: "My Provider",
  async translate({ text, sourceLang, targetLang }) {
    return await requestMyService(text, sourceLang, targetLang);
  }
});
```

Provider 不需要了解阅读器 DOM、缓存或并发队列。阅读器只依赖 `Translation.Service.translate()`，因此 Provider、阅读器渲染和缓存可以分别演进。

## 安装和打包

1. 下载 `.xpi` 文件。
2. 打开 Zotero → 工具 → 插件。
3. 将 `.xpi` 拖入插件窗口并重启 Zotero。

当前本地构建包为 `zot-simplificado-1.3.0.xpi`。

仓库不依赖 Node.js 构建工具。打包时将仓库根目录压缩为 `.xpi`，并确保 `manifest.json` 位于压缩包根目录。

### 自动更新

插件 manifest 中的 `update_url` 指向本仓库的 `updates.json`。发布新版本时，更新 `manifest.json` 的版本号、`updates.json` 的版本与 Release 下载地址，并将同名 `.xpi` 作为 GitHub Release 资产上传。之后 Zotero 的插件更新检查会读取该清单并自动发现新版本；也可以在插件管理器中手动执行检查更新。

当前 `1.3.0` Release 资产名称必须是 `zot-simplificado-1.3.0.xpi`，否则自动更新链接无法命中。

## 兼容性

- Item Key、简记、翻译标题：Zotero 7.0.0–10.0.*
- 沉浸式双语对照：Zotero 10.0.0+

## 许可证

[MIT](LICENSE)
