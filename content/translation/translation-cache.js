(function () {
  const namespace = Zotero.ZotSimplificado;
  const prefs = namespace.prefs;
  const defaultLimit = 300;
  let memory = new Map();
  let persisted = null;

  function getPersisted() {
    if (persisted) return persisted;
    try {
      const parsed = JSON.parse(String(prefs.get("translationCache", "{}")));
      persisted = parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      persisted = {};
    }
    return persisted;
  }

  function limit() {
    return Math.max(20, Math.min(1000, Number(prefs.get("cacheMaxEntries", defaultLimit)) || defaultLimit));
  }

  function flush() {
    const entries = Object.entries(getPersisted())
      .filter(([, value]) => value?.text)
      .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
      .slice(0, limit());
    persisted = Object.fromEntries(entries);
    prefs.set("translationCache", JSON.stringify(persisted));
  }

  function get(key) {
    if (memory.has(key)) return memory.get(key);
    const entry = getPersisted()[key];
    if (!entry?.text) return null;
    memory.set(key, entry.text);
    return entry.text;
  }

  function set(key, text) {
    const value = String(text || "").trim();
    if (!value) return;
    memory.set(key, value);
    getPersisted()[key] = { text: value, updatedAt: Date.now() };
    flush();
  }

  function remove(key) {
    memory.delete(key);
    delete getPersisted()[key];
    flush();
  }

  function clear() {
    memory = new Map();
    persisted = {};
    prefs.set("translationCache", "{}");
  }

  function count() {
    return Object.keys(getPersisted()).length;
  }

  namespace.Translation.Cache = Object.freeze({ get, set, remove, clear, count });
})();
