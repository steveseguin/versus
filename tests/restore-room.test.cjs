const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto').webcrypto;

// Execute the complete production application script. All UI/network boundaries
// are inert fixtures; WebCrypto hashing uses Node's real implementation.
const source = fs.readFileSync(process.env.VERSUS_SOURCE || path.join(__dirname, '..', 'index.html'), 'utf8');
const app = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]).find(s => s.includes('function startRoom()'));
assert.ok(app, 'Production application script must exist');

function createApp(search = '', storage = new Map()) {
  const elements = new Map();
  const posted = [];
  const listeners = new Map();
  const pendingHashes = [];
  function element(tag = 'div') {
    return {
      tagName: tag.toUpperCase(), value: '', type: '', dataset: {},
      style: { setProperty() {} }, children: [],
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      appendChild(x) { this.children.push(x); return x; },
      append(x) { this.children.push(x); },
      addEventListener() {}, querySelectorAll() { return []; },
      querySelector(s) { return byId(s); },
      focus() {}, remove() {}, cloneNode() { return element(tag); },
      contentWindow: {
        addEventListener() {}, postMessage(data) { posted.push(data); }
      }
    };
  }
  function byId(id) {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  }
  const document = {
    getElementById: byId, querySelector: byId, querySelectorAll() { return []; },
    createElement: element, body: element(), documentElement: element(), addEventListener() {}
  };
  const window = {
    location: { search, pathname: '/' }, history: { pushState() {} }, URLSearchParams,
    addEventListener(name, callback) { listeners.set(name, callback); }
  };
  const context = vm.createContext({
    window, document, URLSearchParams, URL, console, TextEncoder, Uint8Array,
    crypto: { subtle: { digest(...args) {
      const result = crypto.subtle.digest(...args);
      pendingHashes.push(result);
      return result;
    } } },
    navigator: { userAgent: 'Chrome/130.0.0.0' },
    setTimeout() { return 1; }, clearTimeout() {}, alert() {}, prompt() { return ''; },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); }, removeItem(key) { storage.delete(key); }
    }
  });
  vm.runInContext(app, context, { filename: 'index.html#application' });
  return {
    context, byId, storage, posted, listeners,
    async settle() {
      await Promise.all(pendingHashes);
      await new Promise(resolve => setImmediate(resolve));
    },
    request(streamID) {
      byId('manualStreamID').value = streamID;
      context.requestStreamManually();
    },
    async start(password = '') {
      byId('roomname').value = 'TournamentA';
      byId('roompassword').value = password;
      context.startRoom();
      await this.settle();
    },
    saved() { return JSON.parse(storage.get('savedRoom')).value; }
  };
}

for (const password of ['simple', 'day+1', '50%', 'café', 'a b', 'literal%2B']) {
  test(`Saved room restore retains password through two reloads: ${password}`, async () => {
    const a = createApp();
    await a.start(password);
    const initialURL = a.context.iframe.src;
    assert.equal(new URL(initialURL).searchParams.get('password'), password);
    let previous = a;
    for (let attempt = 0; attempt < 2; attempt++) {
      const restored = createApp('', previous.storage);
      restored.context.startLastRoom();
      await restored.settle();
      assert.equal(new URL(restored.context.iframe.src).searchParams.get('password'), password);
      assert.equal(restored.context.iframe.src, initialURL);
      assert.equal(restored.byId('inviteLink').value, a.byId('inviteLink').value);
      assert.equal(restored.saved().roompassword, encodeURIComponent(password));
      previous = restored;
    }
  });
}

test('Passwordless restore preserves the room and requested streams', async () => {
  const a = createApp('?room=TournamentA&view=ExistingPlayer');
  await a.settle();
  const b = createApp('', a.storage);
  b.context.startLastRoom();
  await b.settle();
  assert.equal(new URL(b.context.iframe.src).searchParams.get('password'), null);
  assert.equal(b.saved().roomname, 'TournamentA');
  assert.deepEqual(b.saved().viewlist, ['ExistingPlayer']);
});

test('An undecodable legacy saved password does not abort restore', async () => {
  const storage = new Map([['savedRoom', JSON.stringify({
    value: { roomname: 'TournamentA', roompassword: '%', viewlist: false },
    expiry: Date.now() + 60000
  })]]);
  const a = createApp('', storage);
  assert.doesNotThrow(() => a.context.startLastRoom());
  await a.settle();
  assert.equal(new URL(a.context.iframe.src).searchParams.get('password'), '%');
});
