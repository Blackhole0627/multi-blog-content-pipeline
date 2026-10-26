// Navigate to the specific IMAGE chat, type a dummy string, dump the composer
// buttons (so the send button — which only appears once text is present — is
// visible), then CLEAR without sending.
const { chromium } = require('playwright');
const CDP = process.env.ADAPTA_CDP || 'http://127.0.0.1:53821';
const CHAT = process.env.ADAPTA_CHAT_URL ||
  'https://agent.adapta.one/agentic-chat/01a0b486-3006-75c8-8246-e3f9e0323245';

(async () => {
  const browser = await chromium.connectOverCDP(CDP);
  // List every adapta page so we can see what's open.
  const pages = [];
  for (const ctx of browser.contexts()) for (const p of ctx.pages())
    if (p.url().includes('adapta.one')) pages.push(p);
  console.log('ADAPTA PAGES:');
  pages.forEach(p => console.log('  ', p.url()));

  // Prefer a page already on the target chat; else navigate one there.
  let page = pages.find(p => p.url().includes('01a0b486'));
  if (!page) { page = pages[0]; console.log('navigating to CHAT:', CHAT); await page.goto(CHAT, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); }
  await page.bringToFront().catch(() => {});
  console.log('USING:', page.url());

  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  await page.waitForTimeout(300);
  await editor.type('teste de prompt para achar o botao enviar', { delay: 5 });
  await page.waitForTimeout(600);

  // Dump the composer buttons now that text is present.
  const info = await page.evaluate(() => {
    const ce = document.querySelector('[contenteditable="true"]');
    let box = ce; for (let i = 0; i < 7 && box.parentElement; i++) box = box.parentElement;
    return [...box.querySelectorAll('button')].map(b => ({
      aria: b.getAttribute('aria-label'), testid: b.getAttribute('data-testid'),
      type: b.getAttribute('type'), disabled: b.disabled, title: b.getAttribute('title'),
      text: (b.textContent || '').trim().slice(0, 18), hasSvg: !!b.querySelector('svg'),
      cls: (b.className || '').toString().slice(0, 45),
    }));
  });
  console.log('\nCOMPOSER BUTTONS (with text present):\n' + JSON.stringify(info, null, 1));

  // Clear WITHOUT sending.
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
