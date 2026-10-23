import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../../assets/invite.js', import.meta.url), 'utf8');
function page(search, enabled = true, responses = []) {
  const elements = new Map();
  const calls = [];
  let copied = '';
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      hidden: ['save-invite', 'invite-tools', 'inviter', 'account-form'].includes(id), value: '', textContent: '', href: 'cardiaworld://open',
      required: false, disabled: false, events: {}, classList: { add() {}, remove() {} },
      addEventListener(name, callback) { this.events[name] = callback; }, focus() {},
      reset() { for (const item of elements.values()) item.value = ''; },
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    URLSearchParams, AbortSignal,
    window: { location: { search } },
    document: { documentElement: { dataset: { accountInvites: enabled ? 'enabled' : 'pending' } }, getElementById: element, querySelector: () => element('smart-banner') },
    navigator: { clipboard: { async writeText(value) { copied = value; } } },
    localStorage: { setItem() { throw new Error('Session storage is forbidden in this flow'); } },
    async fetch(url, options) {
      calls.push({ url, ...options, body: JSON.parse(options.body) });
      const response = responses.shift() ?? { ok: true, payload: {} };
      return { ok: response.ok, async json() { return response.payload; } };
    },
  });
  vm.runInContext(code, context);
  return { element, calls, copied: () => copied, async click(id) { await element(id).events.click?.(); }, async submit() { await element('account-form').events.submit?.({ preventDefault() {} }); } };
}

test('web fallback offers a legacy Open link and a shareable HTTPS invite without sending anything', async () => {
  const p = page('?username=ExampleFriend');
  assert.equal(p.element('open-app').href, 'cardiaworld://friend/ExampleFriend');
  assert.equal(p.element('inviter').textContent, 'You’re invited by @ExampleFriend');
  assert.equal(p.calls.length, 0);
  await p.click('copy-invite');
  assert.equal(p.copied(), 'https://cardiaworld.com/invite/?username=ExampleFriend');
});

test('missing, duplicate or unsafe invitation parameters never activate signup or an app link', () => {
  for (const search of ['', '?username=ab', '?username=%3Cscript%3E', '?username=One&username=Two']) {
    const p = page(search);
    assert.equal(p.element('save-invite').hidden, true);
    assert.equal(p.element('open-app').href, 'cardiaworld://open');
    assert.equal(p.calls.length, 0);
  }
});

test('pending rollout gives download-and-return instructions without an unverified signup form', () => {
  const p = page('?username=ExampleFriend', false);
  assert.equal(p.element('save-invite').hidden, true);
  assert.match(p.element('install-hint').textContent, /return to this invitation/);
  assert.equal(p.element('account-form').events.submit, undefined);
});

test('signup stores the inviter with the new account so a later app sign-in can recover it', async () => {
  const p = page('?username=ExampleFriend', true, [{ ok: true, payload: { user: { id: 'test-user' } } }]);
  await p.click('show-account');
  p.element('email').value = 'test@example.invalid';
  p.element('username').value = 'NewFriend';
  p.element('password').value = p.element('confirm-password').value = 'not-a-real-credential';
  await p.submit();
  assert.equal(p.calls.length, 1);
  assert.equal(p.calls[0].url, 'https://dvrcmzszdbysscdjnxon.supabase.co/auth/v1/signup?redirect_to=https%3A%2F%2Fcardiaworld.com%2Fconfirmed%2F');
  assert.deepEqual(p.calls[0].body.data, { username: 'NewFriend', friend_invite_username: 'ExampleFriend' });
  assert.match(p.element('account-status').textContent, /Check your email/);
  assert.equal(p.element('password').value, '');
  assert.equal(p.element('confirm-password').value, '');
  assert.equal(p.element('account-form').hidden, true);
});

test('existing-account save changes only invite metadata and revokes the local website session', async () => {
  const p = page('?username=ExampleFriend', true, [{ ok: true, payload: { access_token: 'fake-test-token' } }, { ok: true, payload: {} }, { ok: true, payload: {} }]);
  await p.click('show-account');
  await p.click('account-mode');
  p.element('email').value = 'test@example.invalid';
  p.element('password').value = 'not-a-real-credential';
  await p.submit();
  assert.equal(p.calls.length, 3);
  assert.equal(p.calls[1].method, 'PUT');
  assert.deepEqual(p.calls[1].body, { data: { friend_invite_username: 'ExampleFriend' } });
  assert.match(p.calls[2].url, /logout\?scope=local$/);
  assert.match(p.element('account-status').textContent, /Invitation saved/);
  assert.equal(p.element('password').value, '');
  assert.ok(p.calls.every(call => call.url.startsWith('https://dvrcmzszdbysscdjnxon.supabase.co/auth/v1/')));
});

test('email failures stay visible and allow retry without retaining passwords or claiming success', async () => {
  const p = page('?username=ExampleFriend', true, [{ ok: false, payload: { msg: 'Email delivery unavailable' } }]);
  await p.click('show-account');
  p.element('email').value = 'test@example.invalid';
  p.element('username').value = 'NewFriend';
  p.element('password').value = p.element('confirm-password').value = 'not-a-real-credential';
  await p.submit();
  assert.equal(p.element('account-status').textContent, 'Email delivery unavailable');
  assert.equal(p.element('account-form').hidden, false);
  assert.equal(p.element('submit-account').disabled, false);
  assert.equal(p.element('password').value, '');
});

test('a repeat signup explains that the account exists instead of claiming to send another confirmation', async () => {
  const p = page('?username=ExampleFriend', true, [{ ok: true, payload: { identities: [] } }]);
  await p.click('show-account');
  p.element('email').value = 'existing@example.invalid';
  p.element('username').value = 'ExistingUser';
  p.element('password').value = p.element('confirm-password').value = 'synthetic-password';
  await p.submit();
  assert.match(p.element('account-status').textContent, /account with this email already exists/);
  assert.doesNotMatch(p.element('account-status').textContent, /Check your email/);
  assert.equal(p.element('account-form').hidden, false);
  assert.equal(p.element('password').value, '');
});
