const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:53821');
  let page = null;
  for (const c of b.contexts()) for (const p of c.pages())
    if (/agentic-chat\/[0-9a-f]{8}/i.test(p.url())) { page = p; break; }
  if (!page) { console.log('no chat page'); await b.close(); return; }
  console.log('URL:', page.url());
  const s = await page.evaluate(() => ({
    genImages: document.querySelectorAll('img[alt="Generated image"]').length,
    hasSkip: !!Array.from(document.querySelectorAll('button')).find(x => /Pular/i.test(x.textContent)),
    hasSubjectWidget: /assunto da fotografia|Selecione uma opção/i.test(document.body.innerText),
    lastText: (() => { const a = document.querySelectorAll('[class*="markdown"], p'); return a.length ? a[a.length-1].innerText.slice(0,180) : ''; })(),
    editorFound: !!document.querySelector('[contenteditable="true"]'),
    bodyLen: document.body.innerText.length,
  }));
  console.log(JSON.stringify(s, null, 1));
  await b.close();
})().catch(e => { console.error('ERR', e.message); });
