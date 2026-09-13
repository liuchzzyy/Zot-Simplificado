const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function fixture({ dead = false, waiting = false } = {}) {
  const nodes = new Map(), observers = [], timers = new Map(), translations = [], requests = [];
  let callback, nextTimer = 1, mode = true, cleared = 0;
  function element() {
    return {
      dataset: {}, handlers: {}, style: {}, isConnected: true,
      setAttribute(name, value) { this[name] = value; },
      removeAttribute(name) { delete this[name]; },
      addEventListener(name, fn) { this.handlers[name] = fn; },
      removeEventListener(name) { delete this.handlers[name]; }
    };
  }
  const modeButton = { classList: { contains: () => mode } };
  const doc = {
    ...element(), head: { appendChild: n => nodes.set(n.id, n) },
    createElement: element, getElementById: id => nodes.get(id),
    querySelector: selector => selector === '#readingMode' ? modeButton : null,
    defaultView: { ...element(), MutationObserver: class { constructor() { throw Error('Unwrapped constructor must not be used'); } } }
  };
  const win = {
    ...element(), document: { querySelector: () => ({}) },
    removeEventListener() { if (dead) throw TypeError("can't access dead object"); }
  };
  const observerClass = class {
    constructor(fn) { this.fn = fn; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.disconnected = true; }
  };
  const content = deferred();
  const cache = new Map();
  const source = element();
  const blocks = [{ id: 'p1', text: 'Public test paragraph', source }];
  const namespace = {
    config: { minReaderMajorVersion: 10, reader: { toolbarButtonID: 'toggle', toolbarStyleID: 'style', settingsButtonID: 'settings', sourceStateAttribute: 'state', sourceKeyAttribute: 'key' } },
    utils: { log: (...args) => { throw Error(args.map(String).join(' ')); } },
    Reader: {
      Window: { resolve: () => win, isReadingModeActive: () => mode, waitForContentWindow: () => waiting ? content.promise : Promise.resolve(win) },
      Blocks: { hash: t => t, collect: () => blocks },
      Renderer: { injectStyles() {}, clear() { cleared++; }, setLoading() {}, setTranslation(...args) { translations.push(args); }, setError(...args) { translations.push(args); } }
    },
    Translation: {
      Cache: { get: k => cache.get(k), set: (k,v) => cache.set(k,v), remove: k => cache.delete(k), clear: () => cache.clear() },
      Service: { configurationKey: () => 'test', translate(text, options) { const request = deferred(); requests.push({ ...request, options }); return request.promise; } }
    }
  };
  const context = vm.createContext({
    Zotero: { version: '10.0.2', ZotSimplificado: namespace, getMainWindow: () => ({ MutationObserver: observerClass }), Reader: { registerEventListener(type, fn) { callback = fn; }, unregisterEventListener() {} } },
    setTimeout: (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'content/reader/bilingual-reader.js'), 'utf8'), context);
  namespace.Reader.Bilingual.initialize();
  callback({ reader: {}, doc, append: n => nodes.set(n.id, n) });
  const button = nodes.get('toggle');
  return {
    button, requests, translations, observers, timers, source, content, win, namespace,
    get cleared() { return cleared; },
    click: () => button.handlers.click({ preventDefault() {}, stopPropagation() {} }),
    mode(value) { mode = value; observers.filter(o => o.target === doc && !o.disconnected).forEach(o => o.fn([])); },
    render() { for (const [id, t] of [...timers]) if (t.ms === 50) { timers.delete(id); t.fn(); } },
    unload() { doc.defaultView.handlers.unload(); }
  };
}

test('toolbar and mode observer initialize with the privileged constructor', () => {
  const f = fixture();
  assert.equal(f.button.dataset.enabled, 'false');
  assert.equal(f.observers[0].options.childList, true);
});

test('exiting Reading Mode resets toolbar despite a destroyed SDT window', async () => {
  const f = fixture({ dead: true });
  await f.click();
  assert.equal(f.button.dataset.enabled, 'true');
  f.mode(false);
  assert.equal(f.button.dataset.enabled, 'false');
  assert.equal(f.button['aria-pressed'], 'false');
  assert.ok(f.cleared > 0);
  assert.ok(![...f.timers.values()].some(t => t.ms === 50));
  f.mode(true);
  assert.equal(f.button.dataset.enabled, 'false');
});

test('exiting while waiting for content cannot reactivate bilingual', async () => {
  const f = fixture({ waiting: true });
  const pending = f.click();
  f.mode(false);
  f.content.resolve(f.win);
  await pending;
  assert.equal(f.button.dataset.enabled, 'false');
});

test('a second click cancels a pending activation', async () => {
  const f = fixture({ waiting: true });
  const pending = f.click();
  await f.click();
  f.content.resolve(f.win);
  await pending;
  assert.equal(f.button.dataset.enabled, 'false');
});

test('late success or failure cannot insert translations after exit', async () => {
  for (const fails of [false, true]) {
    const f = fixture();
    await f.click(); f.render();
    assert.equal(f.requests.length, 1);
    f.mode(false);
    assert.equal(f.requests[0].options.isCancelled(), true);
    if (fails) f.requests[0].reject(Error('test failure')); else f.requests[0].resolve('测试译文');
    await flush();
    assert.equal(f.translations.length, 0);
  }
});

test('old requests cannot write into a newly enabled session', async () => {
  const f = fixture();
  await f.click(); f.render();
  await f.click(); await f.click(); f.render();
  assert.equal(f.requests.length, 2);
  f.requests[0].resolve('old'); await flush();
  assert.equal(f.translations.length, 0);
  f.requests[1].resolve('new'); await flush();
  assert.equal(f.translations[0][2], 'new');
});

test('closing a reader and plugin shutdown invalidate pending activation', async () => {
  for (const unload of [false, true]) {
    const f = fixture({ waiting: true });
    const pending = f.click();
    if (unload) f.unload(); else f.namespace.Reader.Bilingual.shutdown();
    f.content.resolve(f.win); await pending;
    assert.equal(f.button.dataset.enabled, 'false');
    assert.ok(f.observers.every(o => o.disconnected));
  }
});

test('translation queue skips cancelled sessions while other work continues', async () => {
  const first = deferred(), calls = [];
  let cancelled = false;
  const ns = { prefs: { get: (key, fallback) => key === 'maxConcurrency' ? 1 : fallback }, Translation: { ProviderRegistry: { get: () => ({ translate: ({ text }) => { calls.push(text); return text === 'first' ? first.promise : Promise.resolve(text); } }) } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'content/translation/translation-service.js'), 'utf8'), { Zotero: { ZotSimplificado: ns } });
  const service = ns.Translation.Service;
  const p1 = service.translate('first');
  const p2 = service.translate('cancelled', { isCancelled: () => cancelled });
  const rejected = assert.rejects(p2, { name: 'AbortError' });
  const p3 = service.translate('other reader');
  cancelled = true; first.resolve('ok');
  await Promise.all([p1, rejected, p3]);
  assert.deepEqual(calls, ['first', 'other reader']);
});
