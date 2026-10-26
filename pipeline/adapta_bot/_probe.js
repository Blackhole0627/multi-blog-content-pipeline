const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:56494', { timeout: 60000 });
  const urls = [];
  for (const c of b.contexts()) for (const p of c.pages()) urls.push(p.url());
  console.log('tabs:', urls.length);
  urls.forEach(u => console.log('  ' + u));
  console.log('adapta tab present?', urls.some(u => u.includes('adapta.one')) ? 'YES' : 'NO');
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
