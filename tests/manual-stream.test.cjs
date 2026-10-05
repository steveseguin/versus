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

for (const search of ['', '?room=TournamentA', '?room=TournamentA&view=', '?room=TournamentA&v=']) {
  test(`Manual stream request works without a populated view parameter: ${search || 'form-created room'}`, async () => {
    const a = createApp(search);
    if (!a.context.roomname) await a.start();
    await a.settle();
    assert.doesNotThrow(() => a.request('PlayerOne'));
    assert.equal(a.posted.length, 1);
    assert.equal(a.posted[0].requestStream, 'PlayerOne');
    assert.deepEqual(a.saved().viewlist, ['PlayerOne']);
    assert.equal(a.byId('modal').style.display, 'none');
  });
}

test('Existing URL view list is preserved when adding another stream', async () => {
  const a = createApp('?room=TournamentA&view=ExistingPlayer');
  await a.settle();
  a.request('PlayerOne');
  assert.deepEqual(a.saved().viewlist, ['ExistingPlayer', 'PlayerOne']);
  assert.equal(a.posted[0].requestStream, 'PlayerOne');
});

test('A connected stream is not requested again', async () => {
  const a = createApp('?room=TournamentA&view=PlayerOne');
  await a.settle();
  a.context.streamIDs.push('PlayerOne');
  a.request('PlayerOne');
  assert.equal(a.posted.length, 0);
});

test('A numeric stream ID is compared against values, not array indices', async () => {
  const a = createApp('?room=TournamentA&view=ExistingPlayer');
  await a.settle();
  a.context.streamIDs.push('ExistingPlayer');
  a.request('0');
  assert.equal(a.posted.length, 1);
  assert.equal(a.posted[0].requestStream, '0');
});

test('Invalid IDs do not alter saved requests or send messages', async () => {
  const a = createApp('?room=TournamentA&view=ExistingPlayer');
  await a.settle();
  const initial = JSON.stringify(a.saved());
  for (const id of ['', 'bad/id', 'bad id', 'x'.repeat(50)]) a.request(id);
  assert.equal(a.posted.length, 0);
  assert.equal(JSON.stringify(a.saved()), initial);
});

