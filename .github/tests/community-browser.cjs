const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright');

const rows = Array.from({length: 25}, (_, i) => ({
  rank: i + 1, username: 'Builder' + i, mayorName: null, buildings: 30 - i, residents: 70 - i,
  ...(i === 1 ? {} : {
    preview: { id: i % 2 === 0 ? 'grove' : 'heritage', days: i + 5, points: (i + 5) * 4,
      namingDays: i + 5, health: 100, population: 18 + i, damage: 0, level: 1,
      customization: {}, lab: false, research: [], life: {} },
  }),
}));

async function check() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: ['--disable-webgl'],
  });
  try {
    const page = await browser.newPage({...devices['iPhone 14'], deviceScaleFactor: 1});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/functions/v1/public-community?*', route => route.fulfill({
      headers: {'Access-Control-Allow-Origin': '*'},
      json: {version: 'public-community-v1', updatedAt: new Date().toISOString(),
        totals: {builders: 25, buildings: 450, residents: 1400}, rows, page: 0, matched: 25,
        hasMore: false, spotlights: {categories: []}},
    }));
    await page.goto(process.env.TEST_SITE_URL ?? 'http://127.0.0.1:4193/#community', {waitUntil: 'domcontentloaded'});
    const scroller = page.locator('[data-community-scroll]');
    await scroller.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.community-world img')?.naturalWidth === 360, undefined, {timeout: 30000});
    assert.equal(await page.locator('#community-rows tr').nth(1).locator('.community-world').count(), 0);
    const before = await page.locator('.community-world img').count();
    await scroller.evaluate(node => { node.scrollTop = 640; });
    await page.waitForFunction(value => document.querySelectorAll('.community-world img').length > value, before);
    await scroller.evaluate(node => { node.scrollTop = 0; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), true);
    assert.equal(await page.locator('.community-world').filter({hasText: 'Preview unavailable'}).count(), 0);
    assert.deepEqual(errors, []);
    await page.locator('.community-board').screenshot({path: 'website-preview-mobile.png'});
    console.log('The leaderboard captures the app world on scroll and respects hidden previews at iPhone width.');
  } finally {
    await browser.close();
  }
}
check().catch(error => { console.error(error); process.exitCode = 1; });
