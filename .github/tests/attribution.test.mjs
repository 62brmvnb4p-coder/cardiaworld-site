import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../../assets/site.js', import.meta.url), 'utf8');

function visit(search) {
  const links = [
    { href: 'https://apps.apple.com/us/app/cardia-world/id6815041207?ct=website' },
    { href: 'https://cardiaworld.com/how-it-works/' },
    { href: 'https://apps.apple.com/us/app/unrelated/id123456789' },
    { href: 'https://example.com/' },
    { href: 'https://cardiaworld.com/build-a-cardio-habit/' },
    { href: 'https://cardiaworld.com/features/' },
    { href: 'https://apps.apple.com/us/app/cardia-world/id6815041207', dataset: { storeEntry: 'pro-preview' } },
    { href: 'https://apps.apple.com/us/app/cardia-world/id6815041207', dataset: { storeEntry: 'pro-host' } },
  ].map(link => ({ ...link, getAttribute: () => link.href }));
  const document = {
    head: { appendChild() {} },
    createElement: tag => ({ tagName: tag }),
    querySelector: () => null,
    querySelectorAll: selector => selector === 'a[href*="apps.apple.com"]'
      ? links.filter(link => new URL(link.href).hostname === 'apps.apple.com') : selector === 'a[href]' ? links : [],
  };
  vm.runInNewContext(code, {
    document, URL, URLSearchParams,
    window: {
      location: { search, href: `https://cardiaworld.com/${search}`, origin: 'https://cardiaworld.com' },
      matchMedia: () => ({ matches: true }),
    },
  });
  return links.map(link => new URL(link.href));
}

test('Reddit paid arrivals reach the matching App Store campaign and retain source across pages', () => {
  const links = visit('?utm_source=reddit&utm_medium=paid_social');
  assert.equal(links[0].searchParams.get('ct'), 'reddit_paid');
  assert.equal(links[0].searchParams.get('pt'), '129494535');
  assert.equal(links[1].searchParams.get('from'), 'reddit');
  assert.equal(links[1].searchParams.get('utm_medium'), 'paid_social');
  assert.equal(links[2].search, '');
  assert.equal(links[3].search, '');
  assert.equal(links[4].searchParams.get('from'), 'reddit');
  assert.equal(links[4].searchParams.get('utm_medium'), 'paid_social');
  assert.equal(links[5].searchParams.get('from'), 'reddit');
  assert.equal(links[5].searchParams.get('utm_medium'), 'paid_social');
});

test('Reddit organic, existing TikTok, and unknown-source downloads remain distinguishable', () => {
  assert.equal(visit('?from=reddit')[0].searchParams.get('ct'), 'reddit_organic');
  assert.equal(visit('?utm_source=tiktok&utm_medium=cpc')[0].searchParams.get('ct'), 'tiktok_paid');
  assert.equal(visit('?utm_source=unknown')[0].searchParams.get('ct'), 'website');
});

test('Pro preview and Battle buttons preserve source and intent without sending visitor identifiers', () => {
  for (const [query, campaign] of [
    ['', 'website'],
    ['?ttclid=private', 'tiktok_paid'],
    ['?utm_source=facebook&utm_medium=cpc', 'facebook_paid'],
    ['?utm_source=instagram&utm_medium=paid_social', 'instagram_paid'],
    ['?rdt_cid=private', 'reddit_paid'],
    ['?from=reddit', 'reddit_organic'],
  ]) {
    const links = visit(query);
    assert.equal(links[0].searchParams.get('ct'), campaign);
    for (const [index, intent] of [[6, 'pro_preview'], [7, 'pro_host']]) {
      assert.deepEqual(Object.fromEntries(links[index].searchParams), {
        pt: '129494535', ct: `${campaign}_${intent}`, mt: '8',
      });
    }
  }
});
