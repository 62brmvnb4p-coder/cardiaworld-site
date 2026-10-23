import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function page(script, { hash = '', search = '', responses = [] } = {}) {
  const elements = new Map(), calls = [], events = {}, replacements = [];
  const location = { hash, search, pathname: '/confirmed/' };
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', hidden: id === 'change-password-form', disabled: true, events: {}, classList: { add() {}, remove() {} }, addEventListener(name, callback) { this.events[name] = callback; } });
    return elements.get(id);
  };
  const storage = { setItem() { throw Error('Recovery session must never be stored'); }, getItem() { throw Error('Recovery must not use stored sessions'); } };
  const context = vm.createContext({ URLSearchParams, AbortSignal, Error, localStorage: storage, sessionStorage: storage,
    window: { location, addEventListener(name, fn) { events[name] = fn; } },
    history: { replaceState(a, b, path) { replacements.push(path); location.hash = ''; location.search = ''; } },
    document: { getElementById: element },
    async fetch(url, options) {
      assert.equal(location.hash, '', 'Discard the fragment before making requests');
      assert.equal(location.search, '', 'Discard query material before making requests');
      calls.push({ url, ...options, body: options.body ? JSON.parse(options.body) : undefined });
      const response = responses.shift() ?? { ok: true, payload: {} };
      if (response.error) throw response.error;
      return { ok: response.ok, status: response.status ?? (response.ok ? 200 : 400), async json() { return response.payload; } };
    },
  });
  vm.runInContext(readFileSync(new URL('../../assets/' + script, import.meta.url), 'utf8'), context);
  return { element, calls, replacements, location, events, async settled() { for (let i = 0; i < 8; i++) await Promise.resolve(); }, async submit(id) { await element(id).events.submit({ preventDefault() {} }); } };
}
const valid = { hash: '#type=recovery&access_token=synthetic-test-token&refresh_token=synthetic-refresh', responses: [{ ok: true, payload: { id: 'existing-account', email: 'person@example.invalid' } }] };

test('request page sends nothing on visit and sends only the entered email without an account session', async () => {
  const p = page('reset-password.js');
  assert.equal(p.calls.length, 0);
  p.element('reset-email').value = ' person@example.invalid ';
  await p.submit('request-reset-form');
  assert.equal(p.calls.length, 1);
  assert.match(p.calls[0].url, /recover\?redirect_to=https%3A%2F%2Fcardiaworld.com%2Fconfirmed%2F$/);
  assert.deepEqual(p.calls[0].body, { email: 'person@example.invalid' });
  assert.equal(p.calls[0].headers.Authorization, undefined);
  assert.equal(p.calls[0].credentials, 'omit');
  assert.match(p.element('request-status').textContent, /If an account uses this address/);
  assert.equal(p.element('request-reset-form').hidden, true);
});

test('invalid email sends nothing; rate limiting remains an error and permits a later retry', async () => {
  const p = page('reset-password.js', { responses: [{ ok: false, status: 429 }] });
  await p.submit('request-reset-form'); assert.equal(p.calls.length, 0);
  p.element('reset-email').value = 'person@example.invalid';
  await p.submit('request-reset-form');
  assert.match(p.element('request-status').textContent, /wait a few minutes/);
  assert.equal(p.element('request-reset-form').hidden, false);
  assert.equal(p.element('request-reset').disabled, false);
});

test('a verified recovery link changes only that account password, clears inputs, and revokes only the temporary session', async () => {
  const p = page('confirmed.js', { ...valid, responses: [...valid.responses, { ok: true, payload: { id: 'existing-account' } }, { ok: true, payload: {} }] });
  await p.settled();
  assert.deepEqual(p.replacements, ['/confirmed/']);
  assert.equal(p.calls[0].method, 'GET');
  assert.equal(p.element('change-password-form').hidden, false);
  p.element('new-password').value = 'synthetic-new-password'; p.element('repeat-password').value = 'different';
  await p.submit('change-password-form'); assert.equal(p.calls.length, 1);
  p.element('repeat-password').value = 'synthetic-new-password';
  await p.submit('change-password-form');
  assert.equal(p.calls[1].method, 'PUT');
  assert.deepEqual(p.calls[1].body, { password: 'synthetic-new-password' });
  assert.match(p.calls[2].url, /logout\?scope=local$/);
  assert(p.calls.every(call => call.url.startsWith('https://dvrcmzszdbysscdjnxon.supabase.co/auth/v1/')));
  assert.equal(p.element('new-password').value, ''); assert.equal(p.element('repeat-password').value, '');
  assert.equal(p.element('confirmation-title').textContent, 'Password updated.');
  await p.submit('change-password-form'); assert.equal(p.calls.length, 3);
  assert(!p.calls.some(call => JSON.stringify(call.body ?? {}).includes('synthetic-refresh')));
  assert(![...['confirmation-title','confirmation-message','password-status'].map(id => p.element(id).textContent)].join(' ').includes('synthetic-test-token'));
});

test('expired, missing, or ambiguous recovery links never enable a password update or claim success', async () => {
  for (const hash of ['', '#type=recovery', '#type=recovery&access_token=one&access_token=two', '#type=recovery&type=signup&access_token=one', '#error=access_denied&error_code=otp_expired']) {
    const p = page('confirmed.js', { hash }); await p.settled();
    assert.equal(p.calls.length, 0); assert.equal(p.element('change-password-form').hidden, true);
    await p.submit('change-password-form'); assert.equal(p.calls.length, 0);
    assert.notEqual(p.element('confirmation-title').textContent, 'Password updated.');
  }
  const p = page('confirmed.js', { ...valid, responses: [{ ok: false, status: 401, payload: {} }] }); await p.settled();
  assert.equal(p.element('change-password-form').hidden, true); assert.equal(p.element('request-another-reset').hidden, false);
});

test('leaving the page discards recovery access and an uncertain update never claims success', async () => {
  const p = page('confirmed.js', { ...valid, responses: [...valid.responses, { error: new TypeError('offline') }] }); await p.settled();
  p.element('new-password').value = p.element('repeat-password').value = 'synthetic-new-password';
  await p.submit('change-password-form');
  assert.match(p.element('password-status').textContent, /couldn’t confirm/);
  assert.notEqual(p.element('confirmation-title').textContent, 'Password updated.');
  assert.equal(p.element('new-password').value, '');
  p.events.pagehide();
  await p.submit('change-password-form'); assert.equal(p.calls.length, 2);
  assert.equal(p.element('change-password-form').hidden, true);
});

test('signup confirmation still returns to the app and discards tokens without starting recovery', () => {
  const p = page('confirmed.js', { hash: '#type=signup&access_token=synthetic-signup&refresh_token=synthetic-refresh' });
  assert.equal(p.element('confirmation-title').textContent, 'Email confirmed.');
  assert.equal(p.calls.length, 0); assert.equal(p.location.hash, ''); assert.equal(p.element('change-password-form').hidden, true);
});
