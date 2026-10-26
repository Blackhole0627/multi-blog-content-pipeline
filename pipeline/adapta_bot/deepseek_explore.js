// Launch Kaik's already-logged-in DeepSeek profile and dump the chat DOM so we
// can write real selectors for the article bot. Read-only (no prompt sent).
const { chromium } = require('playwright');

const PROFILE = process.env.DEEPSEEK_PROFILE ||
  'C:\\Users\\Administrator\\Documents\\workplace-bot2\\worker\\browser_profile_deepseek';

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: null,
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://chat.deepseek.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(5000);
  console.log('URL:', page.url());
  console.log('TITLE:', await page.title());

  const inputs = await page.$$eval('textarea, [contenteditable="true"], input', els =>
    els.map(e => ({ tag: e.tagName, type: e.getAttribute('type'), ph: e.getAttribute('placeholder'),
                    aria: e.getAttribute('aria-label'), id: e.id, cls: (e.className || '').toString().slice(0, 60) }))
       .slice(0, 12));
  console.log('\n=== INPUTS ===\n' + JSON.stringify(inputs, null, 1));

  const buttons = await page.$$eval('button, [role="button"]', els =>
    els.map(e => ({ text: (e.textContent || '').trim().slice(0, 20), aria: e.getAttribute('aria-label'),
                    testid: e.getAttribute('data-testid'), cls: (e.className || '').toString().slice(0, 55) }))
       .filter(e => e.text || e.aria || e.testid).slice(0, 30));
  console.log('\n=== BUTTONS ===\n' + JSON.stringify(buttons, null, 1));

  // Login signal: is a chat input present?
  const loggedIn = await page.locator('textarea, [contenteditable="true"]').count().catch(() => 0);
  console.log('\nlogged-in (chat input present)?', loggedIn > 0 ? 'YES' : 'NO — needs login');

  try { await page.screenshot({ path: 'deepseek_home.png' }); console.log('screenshot -> deepseek_home.png'); } catch (e) {}
  console.log('\n(leaving the browser OPEN so we can reuse it)');
  // Do NOT close — keep the profile/session warm for the article bot test.
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
