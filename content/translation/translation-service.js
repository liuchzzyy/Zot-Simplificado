(function () {
  const namespace = Zotero.ZotSimplificado;
  const prefs = namespace.prefs;
  const registry = namespace.Translation.ProviderRegistry;
  let activeRequests = 0;
  const pendingRequests = [];

  function settings() {
    return {
      provider: String(prefs.get("engine", "google")),
      sourceLang: String(prefs.get("sourceLang", "auto")),
      targetLang: String(prefs.get("targetLang", "zh-CN")),
      baseURL: String(prefs.get("openaiBaseURL", "")).trim().replace(/\/+$/, ""),
      model: String(prefs.get("openaiModel", "")).trim()
    };
  }

  function configurationKey() {
    const current = settings();
    return [current.provider, current.sourceLang, current.targetLang, current.baseURL, current.model].join("|");
  }

  function pump() {
    const limit = Math.max(1, Math.min(6, Number(prefs.get("maxConcurrency", 2)) || 2));
    while (activeRequests < limit && pendingRequests.length) {
      const request = pendingRequests.shift();
      activeRequests += 1;
      Promise.resolve().then(request.task).then(request.resolve, request.reject).finally(() => {
        activeRequests -= 1;
        pump();
      });
    }
  }

  function enqueue(task) {
    return new Promise((resolve, reject) => {
      pendingRequests.push({ task, resolve, reject });
      pump();
    });
  }

  function translate(text, overrides = {}) {
    const current = settings();
    const context = {
      text: String(text || ""),
      sourceLang: overrides.sourceLang || current.sourceLang,
      targetLang: overrides.targetLang || current.targetLang,
      settings: current
    };
    const provider = registry.get(overrides.provider || current.provider);
    if (!provider) return Promise.reject(new Error(`未找到翻译 Provider：${context.settings.provider}`));
    return enqueue(() => {
      // Requests already sent may finish, but queued work from a closed
      // reading session must not consume provider calls.
      if (overrides.isCancelled?.()) {
        const error = new Error("翻译已取消");
        error.name = "AbortError";
        throw error;
      }
      return provider.translate(context);
    });
  }

  function listProviders() {
    return registry.list();
  }

  function listModels(options = {}) {
    const provider = registry.get(options.provider || "openai-compatible");
    if (!provider?.listModels) return Promise.reject(new Error("当前翻译 Provider 不支持读取模型列表"));
    return enqueue(() => provider.listModels({
      baseURL: options.baseURL,
      apiKey: options.apiKey
    }));
  }

  namespace.Translation.Service = Object.freeze({
    settings,
    configurationKey,
    translate,
    listProviders,
    listModels,
    test: (text = "This is a translation test.") => translate(text)
  });
})();
