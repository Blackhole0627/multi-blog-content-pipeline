const { chromium } = require('playwright');
const CDP = 'http://127.0.0.1:51956';
const CHAT = 'https://agent.adapta.one/agentic-chat/01a0dd99-4001-7146-b48b-8b33f2fcba21';
(async () => {
  const b = await chromium.connectOverCDP(CDP, { timeout: 60000 });
  let page = null;
  for (const c of b.contexts()) for (const p of c.pages()) if (p.url().includes(CHAT.split('/').pop())) page = p;
  if (!page) { for (const c of b.contexts()) for (const p of c.pages()) if (p.url().includes('adapta.one')) page = p; }
  if (!page) { console.log('no adapta page'); await b.close(); return; }
  console.log('URL:', page.url());
  const info = await page.evaluate(() => {
    const modal = document.querySelector('[data-ds="tourmaline-modal"][data-state="open"], [role="dialog"]');
    if (!modal) return { modal: false };
    const btns = Array.from(modal.querySelectorAll('button')).map(b => ({
      text: (b.textContent || '').trim().slice(0, 40),
      aria: b.getAttribute('aria-label'),
    }));
    return { modal: true, title: (modal.textContent || '').trim().slice(0, 200), buttons: btns };
  });
  console.log(JSON.stringify(info, null, 2));
  await b.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
