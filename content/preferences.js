(function () {
  const htmlNamespace = "http://www.w3.org/1999/xhtml";

  function init() {
    const root = document.getElementById("zs-bilingual-preferences");
    if (!root) {
      setTimeout(init, 50);
      return;
    }

    const api = Zotero.ZotSimplificado;
    const engine = root.querySelector("#zs-bilingual-engine");
    const openAISettings = root.querySelector("#zs-openai-settings");
    const baseURLInput = root.querySelector("#zs-openai-base-url");
    const apiKeyInput = root.querySelector("#zs-openai-key");
    const modelSelect = root.querySelector("#zs-openai-model");
    const loadModelsButton = root.querySelector("#zs-load-models");
    const status = root.querySelector("#zs-preferences-status");
    const providers = api.Translation.Service.listProviders();
    const providerPopup = engine.querySelector("menupopup");

    for (const provider of providers) {
      const exists = Array.from(providerPopup?.children || []).some((item) => item.value === provider.id);
      if (exists || !providerPopup) continue;
      const item = document.createXULElement("menuitem");
      item.setAttribute("label", provider.displayName || provider.id);
      item.setAttribute("value", provider.id);
      providerPopup.appendChild(item);
    }

    function setStatus(message, type = "normal") {
      status.textContent = message;
      status.dataset.type = type;
    }

    function credentials() {
      return {
        baseURL: baseURLInput.value.trim(),
        apiKey: apiKeyInput.value.trim()
      };
    }

    function credentialsReady() {
      const current = credentials();
      return Boolean(current.baseURL && current.apiKey);
    }

    function resetModels(message = "请先读取模型列表") {
      modelSelect.replaceChildren();
      const option = document.createElementNS(htmlNamespace, "option");
      option.value = "";
      option.textContent = message;
      modelSelect.appendChild(option);
      modelSelect.disabled = true;
    }

    function updateCredentialState() {
      loadModelsButton.disabled = !credentialsReady();
    }

    function invalidateModels() {
      resetModels(credentialsReady() ? "URL 或 API Key 已变化，请重新读取" : "请先填写 URL 和 API Key");
      api.prefs.set("openaiModel", "");
      updateCredentialState();
    }

    function updateEngineVisibility() {
      openAISettings.hidden = engine.value !== "openai-compatible";
    }

    function bindOptionalNumber(input, preference, fallback, minimum, maximum) {
      input.value = api.prefs.hasUserValue(preference) ? String(api.prefs.get(preference, fallback)) : "";
      input.addEventListener("change", () => {
        if (!input.value.trim()) {
          api.prefs.clear(preference);
          input.value = "";
          return;
        }
        const value = Math.max(minimum, Math.min(maximum, Math.round(Number(input.value) || fallback)));
        api.prefs.set(preference, value);
        input.value = String(value);
      });
    }

    async function loadModels() {
      if (!credentialsReady()) {
        invalidateModels();
        return;
      }
      const current = credentials();
      api.prefs.set("openaiBaseURL", current.baseURL);
      api.prefs.set("openaiAPIKey", current.apiKey);
      loadModelsButton.disabled = true;
      modelSelect.disabled = true;
      setStatus("正在读取模型…");
      try {
        const models = await api.Translation.Service.listModels({
          provider: "openai-compatible",
          baseURL: current.baseURL,
          apiKey: current.apiKey
        });
        const savedModel = String(api.prefs.get("openaiModel", ""));
        modelSelect.replaceChildren();
        const placeholder = document.createElementNS(htmlNamespace, "option");
        placeholder.value = "";
        placeholder.textContent = "请选择模型";
        modelSelect.appendChild(placeholder);
        for (const model of models) {
          const option = document.createElementNS(htmlNamespace, "option");
          option.value = model;
          option.textContent = model;
          modelSelect.appendChild(option);
        }
        modelSelect.disabled = false;
        modelSelect.value = models.includes(savedModel) ? savedModel : "";
        if (!modelSelect.value) api.prefs.set("openaiModel", "");
        setStatus(`已读取 ${models.length} 个模型`, "success");
      } catch (error) {
        resetModels("读取失败，请检查 URL 和 API Key");
        setStatus(`读取模型失败：${error?.message || error}`, "error");
      } finally {
        updateCredentialState();
      }
    }

    engine.addEventListener("command", updateEngineVisibility);
    engine.addEventListener("change", updateEngineVisibility);
    engine.addEventListener("syncfrompreference", updateEngineVisibility);
    baseURLInput.addEventListener("input", invalidateModels);
    apiKeyInput.addEventListener("input", invalidateModels);
    baseURLInput.addEventListener("syncfrompreference", updateCredentialState);
    apiKeyInput.addEventListener("syncfrompreference", updateCredentialState);
    loadModelsButton.addEventListener("command", loadModels);
    modelSelect.addEventListener("change", () => api.prefs.set("openaiModel", modelSelect.value));
    bindOptionalNumber(root.querySelector("#zs-cache-limit"), "cacheMaxEntries", 300, 20, 1000);
    bindOptionalNumber(root.querySelector("#zs-concurrency"), "maxConcurrency", 2, 1, 6);

    root.querySelector("#zs-test-translation")?.addEventListener("command", async () => {
      setStatus("测试中…");
      try {
        const result = await api.testTranslation("This is a translation test.");
        setStatus(`成功：${String(result).slice(0, 80)}`, "success");
      } catch (error) {
        setStatus(`失败：${error?.message || error}`, "error");
      }
    });

    root.querySelector("#zs-clear-cache")?.addEventListener("command", () => {
      api.clearTranslationCache();
      setStatus("翻译缓存已清空", "success");
    });

    resetModels();
    updateCredentialState();
    updateEngineVisibility();
  }

  setTimeout(init, 0);
})();
