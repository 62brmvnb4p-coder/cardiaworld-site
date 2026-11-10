import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const code = readFileSync(new URL('../../assets/community.js', import.meta.url), 'utf8');
const row = (index, extra = {}) => ({rank: index + 1, username: 'Builder' + index, mayorName: null, buildings: 100 - index, residents: 200 - index, ...extra});
const packet = (page = 0, extra = {}) => ({version: 'public-community-v1', updatedAt: '2026-11-10T09:30:00Z', totals: {builders: 64, buildings: 129, residents: 518}, rows: Array.from({length: page === 2 ? 14 : 25}, (_, i) => row(page * 25 + i)), page, matched: 64, hasMore: page < 2, spotlights: {closesAt: '2026-11-16T00:00:00Z', categories: []}, ...extra});
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };

function page() {
  class Element {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.events = {}; this.hidden = false; this.scrollTop = 0; this.value = ''; this.ownText = ''; }
    set textContent(value) { this.ownText = String(value); this.children = []; }
    get textContent() { return this.ownText + this.children.map(child => child.textContent).join(' '); }
    append(...children) { this.children.push(...children.flatMap(child => child.tag === 'fragment' ? child.children : [child])); }
    replaceChildren(...children) { this.children = []; this.ownText = ''; this.append(...children); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, fn) { this.events[name] = fn; }
    querySelector(selector) { return nodes.get(selector); }
    querySelectorAll() { return totals; }
    fire(name) { this.events[name]?.({preventDefault() {}}); }
  }
  const nodes = new Map();
  for (const key of ['rows', 'scroll', 'empty', 'status', 'live', 'more', 'refresh', 'search', 'awards', 'week']) nodes.set('[data-community-' + key + ']', new Element());
  const root = new Element(), input = new Element('input'); nodes.set('input', input);
  const totals = ['builders', 'buildings', 'residents'].map(key => { const e = new Element(); e.dataset.communityTotal = key; return e; });
  const timers = new Map(), intervals = [], requests = [];
  let timer = 0, now = Date.parse('2026-11-10T09:30:00Z');
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const document = {hidden: false, querySelector: () => root, createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag), createDocumentFragment: () => new Element('fragment'), addEventListener() {}};
  vm.runInNewContext(code, {document, Intl, Date: Clock, URL, AbortController,
    setTimeout: (fn, ms) => { timers.set(++timer, {fn, ms}); return timer; }, clearTimeout: id => timers.delete(id), setInterval: fn => intervals.push(fn),
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({url, options, resolve: data => resolve({ok: true, json: async () => data}), reject}))
  });
  return {input, root, totals, requests, document, get: key => nodes.get('[data-community-' + key + ']'),
    fire: (key, event = 'click') => nodes.get('[data-community-' + key + ']').fire(event),
    debounce: () => { for (const [id, value] of timers) if (value.ms === 300) { timers.delete(id); value.fn(); } },
    minute: () => { now += 60001; intervals[0](); }};
}

test('live rankings use text nodes and anonymous requests; winners stay separate from current voting', async () => {
  const p = page();
  const named = row(0, {username: '<script>example</script>', mayorName: 'A & B'});
  p.requests[0].resolve(packet(0, {rows: [named], hasMore: false, matched: 1, spotlights: {closesAt: '2026-11-16T00:00:00Z', categories: [
    {id: 'cozy', winner: {...row(0), votes: 8, week: '2026-11-02'}},
    {id: 'night', leader: {...row(1), votes: 0}, entries: 1}
  ]}}));
  await flush();
  assert.deepEqual(p.totals.map(e => e.textContent), ['64', '129', '518']);
  assert.equal(p.get('rows').children[0].children[1].children[0].tag, 'span');
  assert.match(p.get('rows').textContent, /<script>example<\/script>/);
  assert.match(p.get('awards').children[0].textContent, /Latest winner/);
  assert.match(p.get('awards').children[1].textContent, /Voting in progress.*This week’s contender/);
  assert.doesNotMatch(p.get('awards').children[1].textContent, /winner/i);
  assert.match(p.get('awards').children[2].textContent, /Open this week/);
  assert.equal(p.requests[0].options.credentials, 'omit');
  assert.equal(p.requests[0].options.headers, undefined);
});

test('loaded pages and scroll position survive refresh; all builders remain reachable', async () => {
  const p = page(); p.requests[0].resolve(packet()); await flush();
  p.fire('more'); p.requests[1].resolve(packet(1)); await flush();
  assert.equal(p.get('rows').children.length, 50);
  p.get('scroll').scrollTop = 900;
  p.fire('refresh'); p.requests[2].resolve(packet()); await flush(); p.requests[3].resolve(packet(1)); await flush();
  assert.equal(p.get('rows').children.length, 50);
  assert.equal(p.get('scroll').scrollTop, 900);
  p.fire('more'); p.requests[4].resolve(packet(2)); await flush();
  assert.equal(p.get('rows').children.length, 64);
  assert.equal(p.get('more').hidden, true);
  assert.match(p.get('status').textContent, /64 of 64 builders/);
});

test('a late search response cannot replace the newer query; empty searches retain global totals', async () => {
  const p = page(); p.requests[0].resolve(packet()); await flush();
  p.input.value = 'Old'; p.fire('search', 'submit');
  p.input.value = '@Newest'; p.input.fire('input'); p.debounce();
  p.requests[2].resolve(packet(0, {rows: [row(42, {username: 'Newest'})], matched: 1, hasMore: false})); await flush();
  p.requests[1].resolve(packet(0, {rows: [row(9, {username: 'Old'})], matched: 1, hasMore: false})); await flush();
  assert.equal(new URL(p.requests[2].url).searchParams.get('q'), 'newest');
  assert.match(p.get('rows').textContent, /43 Newest|43 @Newest/);
  assert.doesNotMatch(p.get('rows').textContent, /Old/);
  p.input.value = 'Missing'; p.fire('search', 'submit'); p.requests[3].resolve(packet(0, {rows: [], matched: 0, hasMore: false})); await flush();
  assert.match(p.get('empty').textContent, /No builders found/);
  assert.equal(p.totals[0].textContent, '64');
});

test('initial failures can retry, stale refreshes keep rankings, and hidden pages do not poll', async () => {
  const p = page(); p.requests[0].reject(Error('offline')); await flush();
  assert.equal(p.get('live').textContent, 'Unavailable');
  assert.equal(p.get('refresh').disabled, false);
  p.fire('refresh'); p.requests[1].resolve(packet()); await flush();
  p.document.hidden = true; p.minute(); assert.equal(p.requests.length, 2);
  p.document.hidden = false; p.minute(); assert.equal(p.requests.length, 3);
  p.requests[2].reject(Error('offline')); await flush();
  assert.equal(p.get('rows').children.length, 25);
  assert.equal(p.get('live').textContent, 'Needs refresh');
  assert.match(p.get('status').textContent, /last loaded rankings/);
});
