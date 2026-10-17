const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

const kebab = (key) => 'data-' + key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

class FakeText {
  constructor(data) { this.nodeType = 3; this.data = data; this.parentElement = null; }
}

class FakeElement {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.attributes = {};
    this.childNodes = [];
    this.parentElement = null;
    this.classes = new Set();
    this.style = {};
    this.handlers = {};
    this.onclick = null;
    this.title = '';
    const self = this;
    this.dataset = new Proxy({}, {
      get: (_, key) => self.attributes[kebab(String(key))],
      set: (_, key, value) => { self.attributes[kebab(String(key))] = String(value); return true; }
    });
    this.classList = {
      add: (...names) => names.forEach((n) => self.classes.add(n)),
      remove: (...names) => names.forEach((n) => self.classes.delete(n)),
      contains: (name) => self.classes.has(name)
    };
  }
  get firstChild() { return this.childNodes[0] || null; }
  get textContent() { return this.childNodes.map((n) => n.data ?? n.textContent).join(''); }
  set textContent(value) {
    this.childNodes = [];
    if (value !== '' && value !== null && value !== undefined) {
      const text = new FakeText(String(value));
      text.parentElement = this;
      this.childNodes.push(text);
    }
  }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.childNodes.filter((n) => n.nodeType === 1);
    return siblings[siblings.indexOf(this) + 1] || null;
  }
  appendChild(child) { return this.insert(child); }
  insert(child) {
    child.parentElement = this;
    this.childNodes.push(child);
    return child;
  }
  insertAdjacentElement(position, element) {
    const parent = this.parentElement;
    if (position !== 'afterend' || !parent) return null;
    element.parentElement = parent;
    parent.childNodes.splice(parent.childNodes.indexOf(this) + 1, 0, element);
    return element;
  }
  remove() {
    const parent = this.parentElement;
    if (!parent) return;
    parent.childNodes.splice(parent.childNodes.indexOf(this), 1);
    this.parentElement = null;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') this.classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  removeAttribute(name) { delete this.attributes[name]; }
  cloneNode() {
    const clone = new FakeElement(this.tagName);
    clone.attributes = { ...this.attributes };
    clone.classes = new Set(this.classes);
    return clone;
  }
  closest(selector) {
    const name = selector.replace(/^\./, '');
    let node = this;
    while (node) {
      if (node.classes?.has(name)) return node;
      node = node.parentElement;
    }
    return null;
  }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  removeEventListener(type) { delete this.handlers[type]; }
  querySelectorAll(selector) {
    const name = selector.replace(/^\./, '');
    const found = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== 1) continue;
        if (child.classes.has(name)) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
}

function fixture() {
  const styleNodes = new Map();
  const html = new FakeElement('html');
  const doc = new FakeElement('html');
  doc.documentElement = html;
  doc.head = new FakeElement('head');
  doc.body = new FakeElement('body');
  doc.getElementById = (id) => styleNodes.get(id) || null;
  doc.createElement = (tag) => {
    const element = new FakeElement(tag);
    if (tag === 'style') {
      let id = '';
      Object.defineProperty(element, 'id', {
        get: () => id,
        set: (value) => { id = value; styleNodes.set(value, element); }
      });
    }
    return element;
  };
  const selection = { isCollapsed: true, rangeCount: 0, anchorNode: null, focusNode: null, text: '' };
  const win = {
    document: doc,
    getSelection: () => ({
      isCollapsed: selection.isCollapsed,
      rangeCount: selection.isCollapsed ? 0 : 1,
      anchorNode: selection.anchorNode,
      focusNode: selection.focusNode,
      toString: () => (selection.isCollapsed ? '' : selection.text)
    })
  };
  const namespace = {
    config: { reader: {
      translationClass: 'zs-bilingual-translation', loadingClass: 'zs-bilingual-loading',
      errorClass: 'zs-bilingual-error', styleID: 'zs-bilingual-reader-styles'
    } },
    utils: { log: () => {} },
    Reader: {}
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'content/reader/translation-renderer.js'), 'utf8'),
    { Zotero: { ZotSimplificado: namespace }, Array, String }
  );
  const article = doc.insert(new FakeElement('article'));
  const source = article.insert(new FakeElement('p'));
  source.setAttribute('data-ref-path', '3');
  source.textContent = 'Solid-state batteries face obstacles.';
  return { doc, win, namespace, renderer: namespace.Reader.Renderer, source, article, selection };
}

test('re-rendering identical text keeps the existing text node', () => {
  const f = fixture();
  f.renderer.setTranslation(f.source, 'b1', '固态电池面临障碍。');
  const textNode = f.source.nextElementSibling.firstChild;
  f.renderer.setTranslation(f.source, 'b1', '固态电池面临障碍。');
  const target = f.source.nextElementSibling;
  assert.equal(target.firstChild, textNode, 'unchanged translation must not be rewritten');
  assert.equal(target.textContent, '固态电池面临障碍。');
});

test('a changed translation replaces the text', () => {
  const f = fixture();
  f.renderer.setTranslation(f.source, 'b1', '旧译文');
  const before = f.source.nextElementSibling.firstChild;
  f.renderer.setTranslation(f.source, 'b1', '新译文');
  const target = f.source.nextElementSibling;
  assert.notEqual(target.firstChild, before);
  assert.equal(target.textContent, '新译文');
  assert.equal(target.getAttribute('aria-label'), 'Translation');
});

test('loading state does not rewrite the placeholder on every render', () => {
  const f = fixture();
  f.renderer.setLoading(f.source, 'b1');
  const target = f.source.nextElementSibling;
  const placeholder = target.firstChild;
  assert.equal(target.classList.contains('zs-bilingual-loading'), true);
  f.renderer.setLoading(f.source, 'b1');
  assert.equal(target.firstChild, placeholder);
  f.renderer.setTranslation(f.source, 'b1', '译文');
  assert.equal(target.classList.contains('zs-bilingual-loading'), false);
});

test('copying a translation selection writes plain text and beats the reader handler', () => {
  const f = fixture();
  f.renderer.installSelectionSupport(f.win);
  const copyHandler = f.win.document.handlers.copy;
  assert.equal(typeof copyHandler, 'function');
  f.renderer.setTranslation(f.source, 'b1', '固态电池面临障碍。');
  f.selection.isCollapsed = false;
  f.selection.anchorNode = f.source.nextElementSibling.firstChild;
  f.selection.focusNode = f.selection.anchorNode;
  f.selection.text = '固态电池面临障碍。';
  const seen = [];
  const event = {
    clipboardData: { setData: (type, data) => seen.push([type, data]) },
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; }
  };
  copyHandler(event);
  assert.deepEqual(seen, [['text/plain', '固态电池面临障碍。']]);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
});

test('the copy handler leaves selections outside translations alone', () => {
  const f = fixture();
  f.renderer.installSelectionSupport(f.win);
  const copyHandler = f.win.document.handlers.copy;
  f.selection.isCollapsed = false;
  f.selection.anchorNode = f.source.firstChild;
  f.selection.focusNode = f.source.firstChild;
  f.selection.text = 'Solid-state';
  const event = {
    clipboardData: { setData: () => assert.fail('must not touch the clipboard') },
    preventDefault: () => assert.fail('must not prevent the reader copy'),
    stopImmediatePropagation: () => assert.fail('must not stop the reader copy')
  };
  copyHandler(event);
});

test('selection support is installed once and the styles enable selection', () => {
  const f = fixture();
  f.renderer.installSelectionSupport(f.win);
  const first = f.win.document.handlers.copy;
  f.renderer.installSelectionSupport(f.win);
  assert.equal(f.win.document.handlers.copy, first);
  assert.equal(f.win.document.documentElement.dataset.zsBilingualCopy, 'true');
  f.renderer.injectStyles(f.win.document);
  const css = f.win.document.getElementById('zs-bilingual-reader-styles').textContent;
  assert.match(css, /\.zs-bilingual-translation, \.zs-bilingual-translation \* \{[^}]*user-select: text !important/);
});
