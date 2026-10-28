import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../../assets/analytics.js', import.meta.url), 'utf8');
const key = 'cardia_analytics_choice_v1';
function page({url = 'https://cardiaworld.com/', saved, blockedStorage = false, navigator = {}, referrer = ''} = {}) {
  const elements = [];
  const listeners = new Map();
  const storage = new Map(saved ? [[key, JSON.stringify(saved)]] : []);
  const cookieWrites = [];
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.events = {}; this.attributes = {}; elements.push(this); }
    appendChild(child) { this.children.push(child); return child; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { this.events[name] = callback; }
    click() { if (!this.disabled) this.events.click?.({target: this}); }
    focus() { this.focused = true; }
    closest() { return this.tagName === 'a' ? this : null; }
  }
  const head = new Element('head');
  const body = new Element('body');
  const footer = new Element('nav');
  const document = {title: 'Cardia World', referrer, head, body,
    createElement: tag => new Element(tag),
    querySelector: selector => selector === '.site-footer nav' ? footer : null,
    addEventListener: (name, callback) => listeners.set(name, callback)};
  Object.defineProperty(document, 'cookie', {get: () => '_ga=old; _ga_BQ0GPE59HT=old; other=keep', set: value => cookieWrites.push(value)});
  const window = {location: {href: url}};
  const localStorage = {
    getItem: k => { if (blockedStorage) throw Error('blocked'); return storage.get(k) ?? null; },
    setItem: (k, value) => { if (blockedStorage) throw Error('blocked'); storage.set(k, value); }};
  const context = vm.createContext({window, document, navigator, localStorage, URL, Date, Set, JSON, Number});
  vm.runInContext(code, context);
  return {window, head, body, footer, elements, cookieWrites, storage,
    button: name => elements.find(e => e.tagName === 'button' && e.textContent === name),
    banner: () => elements.find(e => e.className === 'analytics-choice'),
    events: () => Array.from(window.dataLayer || [], e => Array.from(e)).filter(e => e[0] === 'event'),
    commands: () => Array.from(window.dataLayer || [], e => Array.from(e)),
    clickLink: href => { const link = new Element('a'); link.href = href; listeners.get('click')?.({target: link}); },
    rerun: () => vm.runInContext(code, context)};
}

test('no Google script or events before consent; decline remembers choice without sending data', () => {
  const p = page();
  assert.equal(p.head.children.length, 0);
  assert.equal(p.events().length, 0);
  assert.equal(p.banner().hidden, false);
  p.button('Decline').click();
  assert.equal(p.banner().hidden, true);
  assert.equal(p.head.children.length, 0);
  assert.equal(JSON.parse(p.storage.get(key)).value, 'denied');
  p.clickLink('https://apps.apple.com/us/app/cardia-world/id6815041207');
  assert.equal(p.events().length, 0);
});

test('consent loads exactly one tag and one page view, with ad features disabled', () => {
  const p = page();
  p.button('Allow analytics').click();
  p.rerun();
  assert.equal(p.head.children.length, 1);
  assert.equal(p.head.children[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-BQ0GPE59HT');
  assert.equal(p.events().filter(e => e[1] === 'page_view').length, 1);
  const config = p.commands().find(e => e[0] === 'config')[2];
  assert.equal(config.send_page_view, false);
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(p.commands().filter(e => e[0] === 'consent').at(-1)[2].ad_storage, 'denied');
});

test('public social labels are retained while raw URL, fragment, and referrer details are removed', () => {
  const p = page({url: 'https://cardiaworld.com/?from=tiktok&utm_medium=paid_social&email=private@example.com#access_token=secret', referrer: 'https://www.reddit.com/r/example/?email=private@example.com'});
  p.button('Allow analytics').click();
  const config = p.commands().find(e => e[0] === 'config')[2];
  assert.equal(config.campaign_source, 'tiktok');
  assert.equal(config.campaign_medium, 'paid_social');
  assert.equal(config.page_location, 'https://cardiaworld.com/');
  assert.equal(config.page_referrer, 'https://www.reddit.com/');
  assert.doesNotMatch(JSON.stringify(p.commands()), /private@|access_token|secret/);
});

test('App Store clicks are a separate event and never include destination query data', () => {
  const p = page({saved: {value: 'granted', updatedAt: Date.now() - 1000}});
  p.clickLink('https://apps.apple.com/us/app/cardia-world/id6815041207?email=private@example.com');
  p.clickLink('https://example.com/id6815041207');
  p.clickLink('https://apps.apple.com/us/app/other/id123');
  const clicks = p.events().filter(e => e[1] === 'app_store_click');
  assert.equal(clicks.length, 1);
  assert.equal(clicks[0][2].link_url, 'https://apps.apple.com/us/app/cardia-world/id6815041207');
  assert.equal(clicks[0][2].website_campaign, 'website');
  assert.doesNotMatch(JSON.stringify(clicks), /private@/);
});

test('footer choices support withdrawal, stop subsequent events, and clear only GA cookies', () => {
  const p = page({saved: {value: 'granted', updatedAt: Date.now() - 1000}});
  p.button('Analytics choices').click();
  assert.equal(p.banner().hidden, false);
  p.button('Decline').click();
  p.clickLink('https://apps.apple.com/us/app/cardia-world/id6815041207');
  assert.equal(p.events().length, 1);
  assert.equal(p.window['ga-disable-G-BQ0GPE59HT'], true);
  assert.equal(p.cookieWrites.length, 6);
  assert.ok(p.cookieWrites.every(c => c.startsWith('_ga')));
});

test('sensitive account/recovery/invitation pages and preview hosts never initialize', () => {
  for (const url of ['https://cardiaworld.com/reset-password/', 'https://cardiaworld.com/confirmed/#access_token=secret', 'https://cardiaworld.com/invite/?code=secret', 'https://example.com/', 'http://localhost/']) {
    const p = page({url, saved: {value: 'granted', updatedAt: Date.now() - 1000}});
    assert.equal(p.head.children.length, 0, url);
    assert.equal(p.window.dataLayer, undefined, url);
    assert.equal(p.banner(), undefined, url);
  }
});

test('all public pages support measurement after consent', () => {
  for (const path of ['/', '/how-it-works/', '/cardio-motivation-app/', '/walking-motivation-app/', '/build-a-cardio-habit/', '/support/', '/privacy/']) {
    const p = page({url: 'https://cardiaworld.com' + path, saved: {value: 'granted', updatedAt: Date.now() - 1000}});
    assert.equal(p.events().length, 1, path);
  }
});

test('expired choices and unavailable storage fail closed; browser privacy signals override consent', () => {
  for (const setup of [{saved: {value: 'granted', updatedAt: 0}}, {blockedStorage: true}]) {
    const p = page(setup);
    assert.equal(p.head.children.length, 0);
    assert.equal(p.banner().hidden, false);
  }
  for (const navigator of [{globalPrivacyControl: true}, {doNotTrack: '1'}]) {
    const p = page({navigator, saved: {value: 'granted', updatedAt: Date.now() - 1000}});
    p.button('Allow analytics').click();
    assert.equal(p.head.children.length, 0);
    assert.equal(p.events().length, 0);
  }
});
