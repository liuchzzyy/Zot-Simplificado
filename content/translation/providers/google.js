(function () {
  const namespace = Zotero.ZotSimplificado;
  const prefs = namespace.prefs;

  function endpoint() {
    return String(prefs.get("googleEndpoint", "https://translate.googleapis.com/translate_a/single")).trim().replace(/\/+$/, "");
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

  function readTranslation(data) {
    if (!Array.isArray(data) || !Array.isArray(data[0])) return "";
    return data[0].map((part) => Array.isArray(part) ? part[0] || "" : "").join("").trim();
  }

  namespace.Translation.registerProvider({
    id: "google",
    displayName: "Google 翻译（网页接口）",
    description: "无需 API Key，适合快速使用；可能受服务商限流影响。",
    async translate({ text, sourceLang, targetLang }) {
      const query = [
        ["client", "gtx"],
        ["sl", sourceLang || "auto"],
        ["tl", targetLang || "zh-CN"],
        ["dt", "t"],
        ["q", text]
      ].map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
      const response = await Zotero.HTTP.request("GET", `${endpoint()}?${query}`, {
        responseType: "json",
        timeout: 30000,
        headers: { Accept: "application/json" }
      });
      const translated = readTranslation(parseResponse(response));
      if (!translated) throw new Error("Google 翻译返回为空");
      return translated;
    }
  });
})();
