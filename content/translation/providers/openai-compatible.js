(function () {
  const namespace = Zotero.ZotSimplificado;
  const prefs = namespace.prefs;
  const defaultPrompt = "You are a professional academic translator. Translate the text accurately and naturally. Output only the translation, without explanations.";

  function normalizeBaseURL(baseURL) {
    const base = String(baseURL || "").trim().replace(/\/+$/, "");
    if (!base) throw new Error("OpenAI 兼容 API 地址不能为空");
    return base;
  }

  function chatEndpoint(baseURL) {
    const base = normalizeBaseURL(baseURL);
    if (/\/chat\/completions$/i.test(base)) return base;
    if (/\/v\d+(?:\.\d+)?$/i.test(base)) return `${base}/chat/completions`;
    return `${base}/v1/chat/completions`;
  }

  function modelsEndpoint(baseURL) {
    const base = normalizeBaseURL(baseURL);
    if (/\/models$/i.test(base)) return base;
    if (/\/chat\/completions$/i.test(base)) return base.replace(/\/chat\/completions$/i, "/models");
    if (/\/v\d+(?:\.\d+)?$/i.test(base)) return `${base}/models`;
    return `${base}/v1/models`;
  }

  function parseResponse(response) {
    const value = response?.response;
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  function readContent(content) {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content.map((part) => typeof part === "string" ? part : part?.text || part?.content || "").join("");
  }

  function readModels(data) {
    const items = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : Array.isArray(data) ? data : [];
    const models = items.map((item) => typeof item === "string" ? item : item?.id || item?.name || "").filter(Boolean);
    return Array.from(new Set(models)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
  }

  namespace.Translation.registerProvider({
    id: "openai-compatible",
    displayName: "OpenAI 兼容 AI API",
    description: "支持 OpenAI、DeepSeek、通义及其他兼容 Chat Completions 的服务。",
    async listModels({ baseURL, apiKey }) {
      const key = String(apiKey || "").trim();
      if (!key) throw new Error("请先填写 API Key");
      const response = await Zotero.HTTP.request("GET", modelsEndpoint(baseURL), {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${key}`
        },
        responseType: "json",
        timeout: 30000
      });
      const data = parseResponse(response);
      const models = readModels(data);
      if (!models.length) throw new Error(data?.error?.message || data?.message || data?.msg || "上游没有返回可用模型");
      return models;
    },
    async translate({ text, sourceLang, targetLang }) {
      const apiKey = String(prefs.get("openaiAPIKey", "")).trim();
      const model = String(prefs.get("openaiModel", "")).trim();
      if (!apiKey) throw new Error("请先填写 OpenAI 兼容 API Key");
      if (!model) throw new Error("请先填写模型名称");
      const response = await Zotero.HTTP.request("POST", chatEndpoint(prefs.get("openaiBaseURL", "https://api.openai.com/v1")), {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: prefs.get("openaiPrompt", defaultPrompt) || defaultPrompt },
            { role: "user", content: `Translate from ${sourceLang || "auto"} to ${targetLang || "zh-CN"}:\n\n${text}` }
          ],
          temperature: 0.2,
          stream: false
        }),
        responseType: "json",
        timeout: 60000
      });
      const data = parseResponse(response);
      const choice = data?.choices?.[0];
      const translated = readContent(choice?.message?.content || data?.text || data?.translation || data?.translatedText).trim();
      if (!translated) throw new Error(data?.error?.message || data?.message || data?.msg || "OpenAI 兼容 API 返回为空");
      return translated;
    }
  });
})();
