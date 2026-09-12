(function () {
  const namespace = Zotero.ZotSimplificado;

  function resolve(reader) {
    const candidates = [];
    const add = (win) => {
      if (win?.document && !candidates.includes(win)) candidates.push(win);
    };
    add(reader?._iframeWindow);
    add(reader?.iframeWindow);
    add(reader?._window);
    add(reader?._iframe?.contentWindow);
    for (let depth = 0; depth < 3; depth++) {
      for (const win of candidates.slice()) {
        try {
          for (const iframe of Array.from(win.document.querySelectorAll("iframe"))) add(iframe.contentWindow);
        } catch {
          continue;
        }
      }
    }
    for (const win of candidates) {
      try {
        if (win.document.querySelector("#sdt-content")) return win;
      } catch {
        continue;
      }
    }
    return candidates[0] || null;
  }

  function hasContent(reader) {
    return !!resolve(reader)?.document?.querySelector("#sdt-content");
  }

  function isReadingModeActive(toolbarDoc) {
    const button = toolbarDoc?.querySelector("#readingMode");
    return button ? button.classList.contains("active") : false;
  }

  async function waitForContentWindow(reader) {
    for (let attempt = 0; attempt < 25; attempt++) {
      const win = resolve(reader);
      if (win?.document?.querySelector("#sdt-content")) return win;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    }
    return null;
  }

  namespace.Reader.Window = Object.freeze({ resolve, hasContent, isReadingModeActive, waitForContentWindow });
})();
