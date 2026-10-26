// One-off exploration script: log into Adapta, take screenshots, dump the DOM
// structure so we can write real selectors instead of guessing.
const { chromium } = require('playwright');
const fs = require('fs');

const EMAIL = process.env.ADAPTA_EMAIL;
const PASS = process.env.ADAPTA_PASS;

if (!EMAIL || !PASS) {
  console.error('Set ADAPTA_EMAIL and ADAPTA_PASS env vars before running.');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const shots = 'shots';
  fs.mkdirSync(shots, { recursive: true });

  try {
    await page.goto('https://adapta.org/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: `${shots}/01-home.png` });
    console.log('Loaded home. Title:', await page.title());
    console.log('URL:', page.url());

    // Log visible links/buttons to find the login entry point
    const links = await page.$$eval('a, button', els =>
      els.slice(0, 60).map(e => ({ tag: e.tagName, text: e.textContent.trim().slice(0, 40), href: e.getAttribute('href') }))
        .filter(e => e.text)
    );
    fs.writeFileSync(`${shots}/01-links.json`, JSON.stringify(links, null, 2));
    console.log('Saved links list, count:', links.length);
  } catch (e) {
    console.error('ERROR on home page:', e.message);
  }

  await browser.close();
})();
