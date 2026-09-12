(function () {
  const namespace = Zotero.ZotSimplificado;
  const config = namespace.config;
  const fields = Object.freeze([
    {
      extraKey: "translated-title",
      column: "translatedTitle",
      row: "zs-translated-title-row",
      l10n: "zs-translated-title-label",
      zh: "翻译标题",
      en: "Translated Title"
    },
    {
      extraKey: "short-note",
      column: "shortNote",
      row: "zs-short-note-row",
      l10n: "zs-short-note-label",
      zh: "简记",
      en: "Short Note"
    }
  ]);
  let registeredColumns = [];
  let registeredRows = [];
  let rowsRegistered = false;

  function getExtraLine(item, key) {
    const extra = item?.getField?.("extra") || "";
    const prefix = `${key}:`;
    for (const line of extra.split(/\r?\n/)) {
      if (line.startsWith(prefix)) return line.slice(prefix.length).replace(/^\s+/, "");
    }
    return "";
  }

  function setExtraLine(item, key, value) {
    const normalized = String(value || "").replace(/\r?\n/g, " ").trim();
    const prefix = `${key}:`;
    const extra = item.getField("extra") || "";
    const lines = extra ? extra.split(/\r?\n/) : [];
    const output = [];
    let found = false;
    for (const line of lines) {
      if (!line.startsWith(prefix)) {
        output.push(line);
        continue;
      }
      if (!found && normalized) output.push(`${key}: ${normalized}`);
      found = true;
    }
    if (!found && normalized) output.push(`${key}: ${normalized}`);
    item.setField("extra", output.join("\n"));
  }

  async function registerColumns() {
    if (registeredColumns.length) return;
    const itemKeyRegistration = await Zotero.ItemTreeManager.registerColumn({
      dataKey: "itemKey",
      label: namespace.utils.localize("条目 ID", "Item Key"),
      pluginID: config.pluginID,
      dataProvider: (item) => item?.key || "",
      showInColumnPicker: true
    });
    const extraColumns = [];
    for (const field of fields) {
      extraColumns.push(await Zotero.ItemTreeManager.registerColumn({
        dataKey: field.column,
        label: namespace.utils.localize(field.zh, field.en),
        pluginID: config.pluginID,
        dataProvider: (item) => getExtraLine(item, field.extraKey),
        showInColumnPicker: true
      }));
    }
    registeredColumns = [itemKeyRegistration, ...extraColumns];
  }

  function registerInfoRows() {
    if (rowsRegistered || !Zotero.ItemPaneManager?.registerInfoRow) return;
    registeredRows = [
      Zotero.ItemPaneManager.registerInfoRow({
        rowID: "zs-item-key-row",
        pluginID: config.pluginID,
        label: { l10nID: "zs-item-key-label", text: namespace.utils.localize("条目 ID", "Item Key") },
        position: "start",
        multiline: false,
        nowrap: true,
        editable: false,
        onGetData: ({ item }) => item?.key || ""
      }),
      ...fields.map((field) => Zotero.ItemPaneManager.registerInfoRow({
        rowID: field.row,
        pluginID: config.pluginID,
        label: { l10nID: field.l10n, text: namespace.utils.localize(field.zh, field.en) },
        position: "start",
        multiline: true,
        nowrap: false,
        editable: true,
        onGetData: ({ item }) => getExtraLine(item, field.extraKey),
        onSetData: ({ item, value }) => {
          setExtraLine(item, field.extraKey, value);
          item.saveTx().catch((error) => Zotero.logError(error));
        }
      }))
    ];
    rowsRegistered = true;
  }

  async function initialize() {
    await registerColumns();
    registerInfoRows();
  }

  async function shutdown() {
    for (const column of registeredColumns) {
      if (column) {
        try {
          await Zotero.ItemTreeManager.unregisterColumn(column);
        } catch (error) {
          namespace.utils.log("注销条目列失败", error);
        }
      }
    }
    registeredColumns = [];
    if (rowsRegistered && Zotero.ItemPaneManager?.unregisterInfoRow) {
      for (const row of registeredRows) {
        if (row) Zotero.ItemPaneManager.unregisterInfoRow(row);
      }
    }
    registeredRows = [];
    rowsRegistered = false;
  }

  function onMainWindowLoad({ window }) {
    window.MozXULElement?.insertFTLIfNeeded("zot-simplificado.ftl");
    registerInfoRows();
    for (const row of registeredRows) Zotero.ItemPaneManager?.refreshInfoRow?.(row);
  }

  function onMainWindowUnload({ window }) {
    window.document.querySelector('link[href="zot-simplificado.ftl"]')?.remove();
  }

  namespace.ItemMetadata = Object.freeze({ initialize, shutdown, onMainWindowLoad, onMainWindowUnload });
})();
