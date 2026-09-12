/* global Zotero, Services */

const bootstrapScope = this;
const MODULES = [
  "content/core/runtime.js",
  "content/item-metadata.js",
  "content/translation/provider-registry.js",
  "content/translation/translation-cache.js",
  "content/translation/providers/google.js",
  "content/translation/providers/openai-compatible.js",
  "content/translation/translation-service.js",
  "content/reader/reader-window.js",
  "content/reader/block-collector.js",
  "content/reader/translation-renderer.js",
  "content/reader/bilingual-reader.js"
];

let registeredPreferencePaneID = null;

function loadModules(rootURI) {
  const baseURI = rootURI.replace(/\/$/, "");
  for (const modulePath of MODULES) {
    Services.scriptloader.loadSubScript(`${baseURI}/${modulePath}`, bootstrapScope);
  }
  return baseURI;
}

async function registerPreferences(baseURI) {
  const namespace = Zotero.ZotSimplificado;
  registeredPreferencePaneID = await Zotero.PreferencePanes.register({
    id: namespace.config.preferencePaneID,
    pluginID: namespace.config.pluginID,
    label: namespace.utils.localize("卜式", "Zot Simplificado"),
    image: `${baseURI}/content/icons/zot-simplificado.svg`,
    src: `${baseURI}/content/preferences.xhtml`,
    scripts: [`${baseURI}/content/preferences.js`],
    stylesheets: [`${baseURI}/content/preferences.css`]
  });
}

async function startup({ rootURI, resourceURI }) {
  await Zotero.initializationPromise;
  const baseURI = loadModules(rootURI || resourceURI.spec);
  await registerPreferences(baseURI);
  await Zotero.ZotSimplificado.ItemMetadata.initialize();
  Zotero.ZotSimplificado.Reader.Bilingual.initialize();
}

async function shutdown() {
  const namespace = Zotero.ZotSimplificado;
  namespace?.Reader?.Bilingual?.shutdown();
  if (registeredPreferencePaneID) {
    Zotero.PreferencePanes.unregister(registeredPreferencePaneID);
    registeredPreferencePaneID = null;
  }
  await namespace?.ItemMetadata?.shutdown?.();
  if (Zotero.ZotSimplificado === namespace) delete Zotero.ZotSimplificado;
}

function install() {}
function uninstall() {}

this.install = install;
this.uninstall = uninstall;
this.startup = startup;
this.shutdown = shutdown;
this.onMainWindowLoad = ({ window }) => Zotero.ZotSimplificado?.ItemMetadata?.onMainWindowLoad({ window });
this.onMainWindowUnload = ({ window }) => Zotero.ZotSimplificado?.ItemMetadata?.onMainWindowUnload({ window });
