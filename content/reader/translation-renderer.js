(function () {
  const namespace = Zotero.ZotSimplificado;
  const config = namespace.config.reader;
  const copyBoundKey = "zsBilingualCopy";

  function injectStyles(doc) {
    if (doc.getElementById(config.styleID)) return;
    const style = doc.createElement("style");
    style.id = config.styleID;
    style.textContent = `
      .${config.translationClass} { color: var(--fill-secondary, currentColor); font-weight: 400; }
      /* A translation carries no SDT ref path, so the reader cannot map or
         annotate a selection inside it. Keep the text selectable and copyable. */
      .${config.translationClass}, .${config.translationClass} * { -moz-user-select: text !important; user-select: text !important; cursor: text; }
      p.${config.translationClass}, blockquote.${config.translationClass}, figcaption.${config.translationClass}, aside.${config.translationClass}, pre.${config.translationClass}, li.${config.translationClass} { margin-top: .35em; margin-bottom: .9em; }
      h1.${config.translationClass}, h2.${config.translationClass}, h3.${config.translationClass}, h4.${config.translationClass}, h5.${config.translationClass}, h6.${config.translationClass} { margin-top: .15em; margin-bottom: .7em; font-size: .86em; }
      .${config.loadingClass} { color: var(--fill-tertiary, currentColor); font-style: italic; }
      .${config.errorClass} { color: var(--accent-red, #b42318); cursor: pointer; }
    `;
    doc.head?.appendChild(style);
  }

  function findTarget(source, blockID) {
    let sibling = source.nextElementSibling;
    while (sibling?.classList.contains(config.translationClass)) {
      if (sibling.dataset.blockKey === blockID) return sibling;
      sibling = sibling.nextElementSibling;
    }
    return null;
  }

  function createTarget(source, blockID) {
    const existing = findTarget(source, blockID);
    if (existing) return existing;
    const target = source.cloneNode(false);
    target.removeAttribute("id");
    target.removeAttribute("data-ref-path");
    target.removeAttribute("data-text-index");
    target.removeAttribute("aria-label");
    target.classList.add(config.translationClass);
    target.dataset.blockKey = blockID;
    source.insertAdjacentElement("afterend", target);
    return target;
  }

  // Assigning textContent always replaces the child text node, and the reader's
  // selection is anchored to that node. Re-renders happen on every scroll,
  // resize and content mutation, so writing unchanged text would keep killing
  // the user's selection. Leave the DOM alone unless the text really changed.
  function writeText(target, text) {
    const unchanged = target.childNodes.length === 1
      && target.firstChild.nodeType === 3
      && target.firstChild.data === text;
    if (!unchanged) target.textContent = text;
  }

  function setLoading(source, blockID) {
    const target = createTarget(source, blockID);
    target.classList.remove(config.errorClass);
    target.classList.add(config.loadingClass);
    target.onclick = null;
    writeText(target, "翻译中…");
    return target;
  }

  function setTranslation(source, blockID, text) {
    const target = createTarget(source, blockID);
    target.classList.remove(config.loadingClass, config.errorClass);
    target.onclick = null;
    writeText(target, text);
    target.setAttribute("aria-label", "Translation");
    return target;
  }

  function setError(source, blockID, message, onRetry) {
    const target = createTarget(source, blockID);
    target.classList.remove(config.loadingClass);
    target.classList.add(config.errorClass);
    writeText(target, "翻译失败，点击重试");
    target.title = String(message || "翻译失败");
    target.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      onRetry();
    };
    return target;
  }

  function insideTranslation(node) {
    const element = node?.nodeType === 1 ? node : node?.parentElement;
    return !!element?.closest?.(`.${config.translationClass}`);
  }

  // The reader maps a selection onto structured-document text before it copies,
  // so any selection touching a translation makes its copy handler bail out.
  // Claim those selections in the capture phase and write the text ourselves.
  function installSelectionSupport(win) {
    const doc = win?.document;
    const root = doc?.documentElement;
    if (!root || root.dataset[copyBoundKey] === "true") return;
    root.dataset[copyBoundKey] = "true";
    doc.addEventListener("copy", (event) => {
      const selection = win.getSelection?.();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;
      if (!insideTranslation(selection.anchorNode) && !insideTranslation(selection.focusNode)) return;
      const text = selection.toString();
      if (!text) return;
      event.clipboardData?.setData("text/plain", text);
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function clear(doc) {
    if (!doc) return;
    for (const node of Array.from(doc.querySelectorAll(`.${config.translationClass}`))) node.remove();
    for (const node of Array.from(doc.querySelectorAll(`[${config.sourceStateAttribute}], [${config.sourceKeyAttribute}]`))) {
      node.removeAttribute(config.sourceStateAttribute);
      node.removeAttribute(config.sourceKeyAttribute);
    }
  }

  namespace.Reader.Renderer = Object.freeze({
    injectStyles, installSelectionSupport, setLoading, setTranslation, setError, clear
  });
})();
