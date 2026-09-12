(function () {
  const namespace = Zotero.ZotSimplificado;
  const config = namespace.config;
  const readerConfig = config.reader;
  const windowAPI = namespace.Reader.Window;
  const blocksAPI = namespace.Reader.Blocks;
  const renderer = namespace.Reader.Renderer;
  const service = namespace.Translation.Service;
  const cache = namespace.Translation.Cache;
  const sessions = new WeakMap();
  const allSessions = new Set();
  let registered = false;
  let readerListener = null;

  function isSupported() {
    const major = Number.parseInt(String(Zotero.version || "0").split(".")[0], 10);
    return Number.isFinite(major) && major >= config.minReaderMajorVersion;
  }

  function getSession(reader, toolbarDoc) {
    let session = sessions.get(reader);
    if (!session) {
      session = {
        reader,
        toolbarDoc,
        win: null,
        enabled: false,
        monitoring: false,
        timer: null,
        suppressUntil: 0,
        observer: null,
        scrollHandler: null,
        resizeHandler: null,
        modeHandler: null,
        modeObserver: null,
        button: null,
        buttonHandler: null,
        inFlight: new Set(),
        blocks: new Map(),
        emptyAttempts: 0
      };
      sessions.set(reader, session);
      allSessions.add(session);
    }
    if (toolbarDoc && session.toolbarDoc !== toolbarDoc && session.modeHandler) {
      session.toolbarDoc?.removeEventListener("click", session.modeHandler, true);
      session.modeObserver?.disconnect();
      session.modeHandler = null;
      session.modeObserver = null;
    }
    session.toolbarDoc = toolbarDoc || session.toolbarDoc;
    return session;
  }

  function toolbarButton(doc) {
    return doc?.getElementById(readerConfig.toolbarButtonID) || null;
  }

  function injectToolbarStyles(doc) {
    if (doc.getElementById(readerConfig.toolbarStyleID)) return;
    const style = doc.createElement("style");
    style.id = readerConfig.toolbarStyleID;
    style.textContent = `
      #${readerConfig.toolbarButtonID} {
        --zs-bilingual-active-color: var(--accent-blue, #4072e5);
        background: var(--material-toolbar, var(--material-background, transparent));
        color: var(--fill-secondary, currentColor);
        border: var(--material-border-quinary, 1px solid rgba(127, 127, 127, .18));
        box-shadow: none;
        font-weight: 600;
        transition: background-color .16s ease, color .16s ease, border-color .16s ease, box-shadow .16s ease;
      }
      #${readerConfig.toolbarButtonID}[data-enabled="true"] {
        background: var(--zs-bilingual-active-color);
        color: var(--accent-white, #fff);
        border: 1px solid var(--zs-bilingual-active-color);
        box-shadow: 0 0 0 3px var(--accent-blue30, rgba(64, 114, 229, .3));
        font-weight: 700;
      }
      :root[data-color-scheme="dark"] #${readerConfig.toolbarButtonID}[data-enabled="true"] {
        --zs-bilingual-active-color: var(--accent-teal, #59adc4);
        color: var(--color-background, #1e1e1e);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-teal, #59adc4) 35%, transparent);
      }
      @media (prefers-color-scheme: dark) {
        :root:not([data-color-scheme]) #${readerConfig.toolbarButtonID}[data-enabled="true"] {
          --zs-bilingual-active-color: var(--accent-teal, #59adc4);
          color: var(--color-background, #1e1e1e);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-teal, #59adc4) 35%, transparent);
        }
      }
    `;
    doc.head?.appendChild(style);
  }

  function updateToolbar(session, enabled) {
    const button = toolbarButton(session.toolbarDoc);
    if (!button) return;
    button.dataset.enabled = String(enabled);
    button.setAttribute("aria-pressed", String(enabled));
    button.title = enabled ? "关闭双语对照" : "开启双语对照";
  }

  function showMessage(doc, message) {
    const win = doc?.defaultView || Zotero.getMainWindow?.();
    if (typeof win?.alert === "function") {
      win.alert(message);
      return;
    }
    namespace.utils.log(message);
  }

  function itemKey(reader) {
    const itemID = reader?.itemID || reader?._itemID;
    if (!itemID) return String(reader?.itemKey || reader?._itemKey || "unknown");
    try {
      const item = Zotero.Items.get(itemID);
      return `${item?.libraryID || "local"}-${item?.key || itemID}`;
    } catch {
      return String(itemID);
    }
  }

  function cacheKey(session, block) {
    return ["v2", itemKey(session.reader), block.id, blocksAPI.hash(block.text), service.configurationKey()].join(":");
  }

  function isOwnMutation(mutation) {
    const changedNodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
    if (!changedNodes.length) return mutation.target?.classList?.contains(readerConfig.translationClass) === true;
    return changedNodes.every((node) => {
      if (!node) return true;
      const element = node.nodeType === 1 ? node : node.parentElement;
      return element?.classList?.contains(readerConfig.translationClass) || element?.closest?.(`.${readerConfig.translationClass}`);
    });
  }

  function installMonitoring(session) {
    const win = windowAPI.resolve(session.reader);
    if (!win?.document) return;
    if (session.monitoring && session.win === win) return;
    stopMonitoring(session);
    session.win = win;
    session.monitoring = true;
    renderer.injectStyles(win.document);
    session.scrollHandler = () => scheduleRender(session, 150);
    session.resizeHandler = () => scheduleRender(session, 150);
    win.addEventListener("scroll", session.scrollHandler, true);
    win.addEventListener("resize", session.resizeHandler);
    const root = win.document.querySelector("#sdt-content");
    if (root && typeof MutationObserver !== "undefined") {
      session.observer = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => !isOwnMutation(mutation))) scheduleRender(session, 250);
      });
      session.observer.observe(root, { childList: true, subtree: true });
    }
  }

  function stopMonitoring(session) {
    if (session.timer && session.win) session.win.clearTimeout(session.timer);
    session.timer = null;
    if (session.scrollHandler && session.win) session.win.removeEventListener("scroll", session.scrollHandler, true);
    if (session.resizeHandler && session.win) session.win.removeEventListener("resize", session.resizeHandler);
    session.observer?.disconnect();
    session.scrollHandler = null;
    session.resizeHandler = null;
    session.observer = null;
    session.monitoring = false;
  }

  function deactivate(session) {
    session.enabled = false;
    stopMonitoring(session);
    renderer.clear(session.win?.document);
    updateToolbar(session, false);
  }

  function scheduleRender(session, milliseconds) {
    if (!session.enabled || Date.now() < session.suppressUntil || !session.win) return;
    if (session.timer) session.win.clearTimeout(session.timer);
    session.timer = session.win.setTimeout(() => {
      session.timer = null;
      render(session).catch((error) => namespace.utils.log("阅读器渲染失败", error));
    }, milliseconds);
  }

  async function translateBlock(session, block) {
    const key = cacheKey(session, block);
    if (cache.get(key)) return;
    if (session.inFlight.has(key)) return;
    session.inFlight.add(key);
    block.source.setAttribute(readerConfig.sourceStateAttribute, "pending");
    block.source.setAttribute(readerConfig.sourceKeyAttribute, key);
    try {
      const translated = String(await service.translate(block.text)).trim();
      if (!translated) throw new Error("翻译结果为空");
      cache.set(key, translated);
      if (session.enabled && block.source.isConnected) {
        renderer.setTranslation(block.source, block.id, translated);
        block.source.setAttribute(readerConfig.sourceStateAttribute, "done");
        session.suppressUntil = Date.now() + 300;
      }
    } catch (error) {
      if (session.enabled && block.source.isConnected) {
        block.source.setAttribute(readerConfig.sourceStateAttribute, "error");
        renderer.setError(block.source, block.id, error?.message || error, () => retryBlock(session, block));
      }
    } finally {
      session.inFlight.delete(key);
    }
  }

  function retryBlock(session, block) {
    const key = cacheKey(session, block);
    session.inFlight.delete(key);
    cache.remove(key);
    block.source.removeAttribute(readerConfig.sourceStateAttribute);
    block.source.removeAttribute(readerConfig.sourceKeyAttribute);
    renderer.setLoading(block.source, block.id);
    void translateBlock(session, block);
  }

  async function render(session) {
    if (!session.enabled) return;
    const modeButton = session.toolbarDoc?.querySelector("#readingMode");
    if ((modeButton && !windowAPI.isReadingModeActive(session.toolbarDoc)) || (!modeButton && !windowAPI.hasContent(session.reader))) {
      deactivate(session);
      return;
    }
    const win = windowAPI.resolve(session.reader);
    if (win && win !== session.win) installMonitoring(session);
    if (!session.win?.document?.querySelector("#sdt-content")) {
      session.emptyAttempts += 1;
      if (session.emptyAttempts < 25) scheduleRender(session, 250);
      return;
    }
    session.emptyAttempts = 0;
    const blocks = blocksAPI.collect(session.win);
    session.blocks = new Map(blocks.map((block) => [block.id, block]));
    for (const block of blocks) {
      const key = cacheKey(session, block);
      const translated = cache.get(key);
      if (translated) {
        renderer.setTranslation(block.source, block.id, translated);
        block.source.setAttribute(readerConfig.sourceStateAttribute, "done");
        block.source.setAttribute(readerConfig.sourceKeyAttribute, key);
      } else {
        renderer.setLoading(block.source, block.id);
        void translateBlock(session, block);
      }
    }
  }

  function installModeHandler(session) {
    if (session.modeHandler || !session.toolbarDoc) return;
    session.modeHandler = (event) => {
      if (!event.target?.closest?.("#readingMode")) return;
      setTimeout(() => {
        if (!session.enabled) return;
        if (windowAPI.isReadingModeActive(session.toolbarDoc)) {
          installMonitoring(session);
          scheduleRender(session, 100);
        } else {
          deactivate(session);
        }
      }, 350);
    };
    session.toolbarDoc.addEventListener("click", session.modeHandler, true);
    const Observer = session.toolbarDoc.defaultView?.MutationObserver;
    if (Observer) {
      session.modeObserver = new Observer(() => {
        if (session.enabled && !windowAPI.isReadingModeActive(session.toolbarDoc)) deactivate(session);
      });
      session.modeObserver.observe(session.toolbarDoc, {
        attributes: true,
        subtree: true,
        attributeFilter: ["class", "aria-pressed", "data-active", "data-state"]
      });
    }
  }

  function installButtonHandler(session, button) {
    if (!button) return;
    if (session.button === button && session.buttonHandler) return;
    if (session.button && session.buttonHandler) session.button.removeEventListener("click", session.buttonHandler);
    session.button = button;
    session.buttonHandler = async (eventClick) => {
      eventClick.preventDefault();
      eventClick.stopPropagation();
      updateToolbar(session, await setEnabled(session, !session.enabled));
    };
    button.addEventListener("click", session.buttonHandler);
  }

  function addSettingsButton(doc, append) {
    if (doc.getElementById(readerConfig.settingsButtonID)) return;
    const button = doc.createElement("button");
    button.id = readerConfig.settingsButtonID;
    button.type = "button";
    button.textContent = "⚙";
    button.title = "双语翻译设置";
    button.style.cssText = "min-width: 28px; height: 28px; padding: 0 8px; border: 1px solid var(--material-border-quinary, rgba(0,0,0,.18)); border-radius: 4px; background: var(--material-background, rgba(255,255,255,.85)); color: inherit; font-size: 13px; cursor: pointer;";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      namespace.openPreferences();
    });
    append(button);
  }

  function attachToolbar(event) {
    const { reader, doc, append } = event || {};
    if (!reader || !doc || typeof append !== "function") return;
    injectToolbarStyles(doc);
    const session = getSession(reader, doc);
    let button = toolbarButton(doc);
    if (!button) {
      const button = doc.createElement("button");
      button.id = readerConfig.toolbarButtonID;
      button.type = "button";
      button.textContent = "双语";
      button.title = "沉浸式双语对照";
      button.style.cssText = "min-width: 44px; height: 28px; padding: 0 10px; border-radius: 4px; font-size: 12px; cursor: pointer;";
      append(button);
    }
    button = toolbarButton(doc);
    installButtonHandler(session, button);
    addSettingsButton(doc, append);
    installModeHandler(session);
    updateToolbar(session, session.enabled);
  }

  async function setEnabled(session, enabled) {
    if (!enabled) {
      deactivate(session);
      return false;
    }
    if (!isSupported()) {
      showMessage(session.toolbarDoc, "沉浸式双语对照需要 Zotero 10 或更高版本。");
      return false;
    }
    if (!windowAPI.isReadingModeActive(session.toolbarDoc)) {
      showMessage(session.toolbarDoc, "请先打开 Zotero 阅读模式。");
      return false;
    }
    const win = await windowAPI.waitForContentWindow(session.reader);
    if (!win) {
      showMessage(session.toolbarDoc, "没有找到阅读模式正文，请稍后重试。");
      return false;
    }
    session.win = win;
    session.enabled = true;
    installMonitoring(session);
    scheduleRender(session, 50);
    return true;
  }

  function syncExistingReaders() {
    for (const reader of Zotero.Reader?._readers || []) {
      const windows = [reader?._iframeWindow, reader?.iframeWindow, reader?._window, reader?._iframe?.contentWindow];
      for (const win of windows) {
        const doc = win?.document;
        const button = toolbarButton(doc);
        if (!doc || !button) continue;
        const session = getSession(reader, doc);
        installButtonHandler(session, button);
        installModeHandler(session);
        if (!windowAPI.isReadingModeActive(doc)) {
          deactivate(session);
        } else {
          updateToolbar(session, session.enabled);
        }
      }
    }
  }

  function clearAll() {
    cache.clear();
    for (const session of allSessions) {
      if (!session.enabled) continue;
      renderer.clear(session.win?.document);
      session.suppressUntil = 0;
      scheduleRender(session, 50);
    }
  }

  namespace.Reader.Bilingual = Object.freeze({
    initialize() {
      if (registered || !Zotero.Reader?.registerEventListener) return;
      readerListener = attachToolbar;
      Zotero.Reader.registerEventListener("renderToolbar", readerListener, config.pluginID);
      registered = true;
      setTimeout(syncExistingReaders, 300);
    },
    shutdown() {
      if (readerListener && Zotero.Reader?.unregisterEventListener) Zotero.Reader.unregisterEventListener("renderToolbar", readerListener);
      for (const session of allSessions) {
        session.enabled = false;
        stopMonitoring(session);
        renderer.clear(session.win?.document);
        if (session.modeHandler && session.toolbarDoc) session.toolbarDoc.removeEventListener("click", session.modeHandler, true);
        session.modeObserver?.disconnect();
        if (session.button && session.buttonHandler) session.button.removeEventListener("click", session.buttonHandler);
      }
      allSessions.clear();
      registered = false;
      readerListener = null;
    },
    clearAll
  });
  namespace.clearTranslationCache = clearAll;
})();
