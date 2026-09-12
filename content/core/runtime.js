(function () {
  const config = Object.freeze({
    pluginID: "zot-simplificado@liuchzzyy",
    namespaceKey: "ZotSimplificado",
    displayName: "Zot Simplificado",
    preferencePaneID: "zs-preferences",
    prefsPrefix: "extensions.zotero.zotSimplificado",
    minReaderMajorVersion: 10,
    reader: Object.freeze({
      toolbarButtonID: "zs-bilingual-toggle",
      toolbarStyleID: "zs-bilingual-toolbar-styles",
      settingsButtonID: "zs-bilingual-settings",
      translationClass: "zs-bilingual-translation",
      loadingClass: "zs-bilingual-loading",
      errorClass: "zs-bilingual-error",
      styleID: "zs-bilingual-reader-styles",
      sourceStateAttribute: "data-zs-bilingual-state",
      sourceKeyAttribute: "data-zs-bilingual-key"
    })
  });
  const namespace = Zotero[config.namespaceKey] || {};
  Zotero[config.namespaceKey] = namespace;

  function getPref(name, fallback) {
    const value = Zotero.Prefs.get(`${config.prefsPrefix}.${name}`, true);
    return value === undefined || value === null ? fallback : value;
  }

  function setPref(name, value) {
    Zotero.Prefs.set(`${config.prefsPrefix}.${name}`, value, true);
  }

  function clearPref(name) {
    Zotero.Prefs.clear(`${config.prefsPrefix}.${name}`, true);
  }

  function hasUserPref(name) {
    return Zotero.Prefs.prefHasUserValue(`${config.prefsPrefix}.${name}`, true);
  }

  function localize(zh, en) {
    return String(Zotero.locale || "en").startsWith("zh") ? zh : en;
  }

  function log(message, error) {
    const prefix = `[${config.displayName}] ${message}`;
    if (error) {
      Zotero.logError?.(error);
      Zotero.debug?.(`${prefix}: ${error.message || error}`);
      return;
    }
    Zotero.debug?.(prefix);
  }

  namespace.config = config;
  namespace.prefs = Object.freeze({ get: getPref, set: setPref, clear: clearPref, hasUserValue: hasUserPref });
  namespace.utils = Object.freeze({ localize, log });
  namespace.Translation ||= {};
  namespace.Reader ||= {};
  namespace.ItemMetadata ||= {};
  namespace.openPreferences = () => Zotero.Utilities.Internal.openPreferences(config.preferencePaneID);
  namespace.testTranslation = (text) => namespace.Translation.Service.test(text);
  namespace.clearTranslationCache = () => namespace.Translation.Cache.clear();
})();
