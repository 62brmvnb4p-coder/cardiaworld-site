import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const text = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const script = text('../../assets/battle-invite.js');
const html = text('../../invite/cardio-battle/index.html');
const token = '12345678-abcd-4abc-9123-123456789abc';
const link = 'https://cardiaworld.com/invite/cardio-battle/?code=' + token;

function openPage(search) {
  const elements = new Map();
  const byId = id => {
    if (!elements.has(id)) elements.set(id, { hidden: true, addEventListener(event, fn) { this[event] = fn; } });
    return elements.get(id);
  };
  const banner = {};
  const clipboard = [];
  vm.runInNewContext(script, {
    document: { getElementById: byId, querySelector: () => banner },
    window: { location: { search } },
    navigator: { clipboard: { writeText: async value => clipboard.push(value) } },
    URLSearchParams,
  });
  return { byId, banner, clipboard };
}

test('the Battle landing page offers the App Store, opens the exact challenge, and copies a shareable link', async () => {
  assert.match(html, /You’ve been challenged to a Cardio Battle/);
  assert.match(html, /apps\.apple\.com\/us\/app\/cardia-world\/id6815041207/);
  assert.match(html, /tap the link in your original invitation/);
  const page = openPage('?code=' + token.toUpperCase());
  assert.equal(page.byId('open-battle').hidden, false);
  assert.equal(page.byId('open-battle').href, 'cardiaworld://battle/' + token);
  assert.equal(page.banner.content, 'app-id=6815041207, app-argument=' + link);
  await page.byId('copy-battle-link').click();
  assert.deepEqual(page.clipboard, [link]);
});

test('missing or duplicate tokens never open Cardia World', () => {
  for (const query of ['', '?code=invalid', '?code=' + token + '&code=' + token]) {
    const page = openPage(query);
    assert.equal(page.byId('open-battle').hidden, true);
    assert.match(page.byId('invite-title').textContent, /incomplete/);
  }
});
