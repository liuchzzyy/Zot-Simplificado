(function () {
  const namespace = Zotero.ZotSimplificado;
  const providers = new Map();

  function register(provider) {
    if (!provider?.id || typeof provider.translate !== "function") {
      throw new Error("翻译 Provider 必须提供 id 和 translate() 方法");
    }
    providers.set(provider.id, Object.freeze({ ...provider }));
  }

  function get(id) {
    return providers.get(id) || null;
  }

  function unregister(id) {
    return providers.delete(id);
  }

  function list() {
    return Array.from(providers.values());
  }

  namespace.Translation.ProviderRegistry = Object.freeze({ register, get, unregister, list });
  namespace.Translation.registerProvider = register;
})();
