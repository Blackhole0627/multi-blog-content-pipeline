// Find the composer's send button + how submit works.
const { chromium } = require('playwright');
const CDP = process.env.ADAPTA_CDP || 'http://127.0.0.1:53821';
(async () => {
  const browser = await chromium.connectOverCDP(CDP);
  let page = null;
  for (const ctx of browser.contexts())
    for (const p of ctx.pages())
      if (p.url().includes('agent.adapta.one/agentic-chat')) { page = p; break; }
  if (!page) { console.log('no chat page'); await browser.close(); return; }

  const info = await page.evaluate(() => {
    const ce = document.querySelector('[contenteditable="true"].tiptap, [contenteditable="true"]');
    if (!ce) return { err: 'no contenteditable' };
    // Walk up to a composer container, then list its buttons.
    let box = ce;
    for (let i = 0; i < 6 && box.parentElement; i++) box = box.parentElement;
    const btns = [...box.querySelectorAll('button')].map(b => ({
      aria: b.getAttribute('aria-label'),
      type: b.getAttribute('type'),
      disabled: b.disabled || b.getAttribute('aria-disabled'),
      dataState: b.getAttribute('data-state'),
      testid: b.getAttribute('data-testid'),
      title: b.getAttribute('title'),
      text: (b.textContent || '').trim().slice(0, 20),
      hasSvg: !!b.querySelector('svg'),
      cls: (b.className || '').toString().slice(0, 55),
    }));
    return { composerTag: box.tagName, composerCls: (box.className||'').toString().slice(0,60), buttonCount: btns.length, buttons: btns };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
