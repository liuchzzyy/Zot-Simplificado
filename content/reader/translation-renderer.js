(function () {
  const namespace = Zotero.ZotSimplificado;
  const config = namespace.config.reader;

  function injectStyles(doc) {
    if (doc.getElementById(config.styleID)) return;
    const style = doc.createElement("style");
    style.id = config.styleID;
    style.textContent = `
      .${config.translationClass} { color: var(--fill-secondary, currentColor); font-weight: 400; user-select: text; }
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

  function setLoading(source, blockID) {
    const target = createTarget(source, blockID);
    target.classList.add(config.loadingClass);
    target.classList.remove(config.errorClass);
    target.onclick = null;
    target.textContent = "翻译中…";
    return target;
  }

  function setTranslation(source, blockID, text) {
    const target = createTarget(source, blockID);
    target.classList.remove(config.loadingClass, config.errorClass);
    target.onclick = null;
    target.textContent = text;
    target.setAttribute("aria-label", "Translation");
    return target;
  }

  function setError(source, blockID, message, onRetry) {
    const target = createTarget(source, blockID);
    target.classList.remove(config.loadingClass);
    target.classList.add(config.errorClass);
    target.textContent = "翻译失败，点击重试";
    target.title = String(message || "翻译失败");
    target.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      onRetry();
    };
    return target;
  }

  function clear(doc) {
    if (!doc) return;
    for (const node of Array.from(doc.querySelectorAll(`.${config.translationClass}`))) node.remove();
    for (const node of Array.from(doc.querySelectorAll(`[${config.sourceStateAttribute}], [${config.sourceKeyAttribute}]`))) {
      node.removeAttribute(config.sourceStateAttribute);
      node.removeAttribute(config.sourceKeyAttribute);
    }
  }

  namespace.Reader.Renderer = Object.freeze({ injectStyles, setLoading, setTranslation, setError, clear });
})();
