(function () {
  const namespace = Zotero.ZotSimplificado;
  const translationClass = namespace.config.reader.translationClass;
  const allowedTags = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "figcaption", "blockquote", "li", "aside", "pre"]);

  function hash(text) {
    let value = 0;
    for (let index = 0; index < text.length; index++) value = (value * 31 + text.charCodeAt(index)) | 0;
    return String(value >>> 0);
  }

  function textOf(source) {
    return String(source.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isReadable(source) {
    if (!source || source.nodeType !== 1) return false;
    if (source.classList.contains(translationClass) || source.closest(`.${translationClass}`)) return false;
    if (source.closest("nav, aside[role='navigation'], toolbar, button, menu, menupopup")) return false;
    return allowedTags.has(source.tagName.toLowerCase());
  }

  function collect(win) {
    const root = win?.document?.querySelector("#sdt-content");
    if (!root) return [];
    const candidates = [];
    for (const element of Array.from(root.children)) {
      const tag = element.tagName.toLowerCase();
      if (tag === "ul" || tag === "ol") {
        candidates.push(...Array.from(element.children).filter((child) => child.tagName?.toLowerCase() === "li"));
      } else {
        candidates.push(element);
      }
    }
    const viewportHeight = Math.max(1, win.innerHeight || 800);
    const seen = new Set();
    const blocks = [];
    candidates.forEach((source, index) => {
      if (!isReadable(source)) return;
      const text = textOf(source);
      const tag = source.tagName.toLowerCase();
      const minimum = /^h[1-6]$/.test(tag) ? 2 : tag === "li" ? 8 : 20;
      if (text.length < minimum) return;
      const rect = source.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 8 || rect.bottom < -120 || rect.top > viewportHeight + 240) return;
      const baseID = source.getAttribute("data-ref-path") || source.id || `${index}-${hash(text)}`;
      const id = seen.has(baseID) ? `${baseID}-${index}` : baseID;
      seen.add(baseID);
      blocks.push({ id, source, text, rect });
    });
    return blocks;
  }

  namespace.Reader.Blocks = Object.freeze({ collect, hash, textOf });
})();
