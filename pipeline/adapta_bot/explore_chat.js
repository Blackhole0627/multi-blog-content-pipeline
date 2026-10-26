// Read-only DOM dump of the live Adapta agentic-chat, so we can write real
// selectors for the image bot. Connects to Kaik's MoreLogin over CDP.
const { chromium } = require('playwright');

const CDP = process.env.ADAPTA_CDP || 'http://127.0.0.1:53821';

(async () => {
  const browser = await chromium.connectOverCDP(CDP);
  let page = null;
  for (const ctx of browser.contexts()) {
    for (const p of ctx.pages()) {
      if (p.url().includes('agent.adapta.one/agentic-chat')) { page = p; break; }
    }
    if (page) break;
  }
  if (!page) { console.log('NO adapta agentic-chat page found'); await browser.close(); return; }

  console.log('URL:', page.url());
  console.log('TITLE:', await page.title());

  const inputs = await page.$$eval('textarea, [contenteditable="true"], input', els =>
    els.map(e => ({ tag: e.tagName, type: e.getAttribute('type'), ce: e.getAttribute('contenteditable'),
                    ph: e.getAttribute('placeholder'), aria: e.getAttribute('aria-label'),
                    cls: (e.className || '').toString().slice(0, 70) })));
  console.log('\n=== INPUTS ===\n' + JSON.stringify(inputs, null, 1));

  const buttons = await page.$$eval('button, [role="button"]', els =>
    els.map(e => ({ text: (e.textContent || '').trim().slice(0, 30),
                    aria: e.getAttribute('aria-label'), title: e.getAttribute('title'),
                    cls: (e.className || '').toString().slice(0, 60) }))
       .filter(e => e.text || e.aria || e.title).slice(0, 50));
  console.log('\n=== BUTTONS ===\n' + JSON.stringify(buttons, null, 1));

  const imgs = await page.$$eval('img', els =>
    els.map(e => ({ src: (e.src || '').slice(0, 70), alt: e.getAttribute('alt'),
                    w: e.naturalWidth, h: e.naturalHeight,
                    cls: (e.className || '').toString().slice(0, 40) }))
       .filter(e => e.src).slice(0, 25));
  console.log('\n=== IMAGES (incl. blobs = generated) ===\n' + JSON.stringify(imgs, null, 1));

  try { await page.screenshot({ path: 'adapta_chat.png', fullPage: false }); console.log('\nscreenshot -> adapta_chat.png'); }
  catch (e) { console.log('screenshot failed:', e.message); }

  await browser.close(); // CDP: disconnect only, does NOT close the real browser
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
