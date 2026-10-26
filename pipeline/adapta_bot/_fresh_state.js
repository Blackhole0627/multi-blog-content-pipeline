const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:51956',{timeout:60000});
  let page=null; for (const c of b.contexts()) for (const p of c.pages()) if (p.url().includes('01a0f6c0')) page=p;
  if(!page){console.log('fresh chat tab not found');await b.close();return;}
  const s = await page.evaluate(()=>({
    imgs: document.querySelectorAll('img[alt="Generated image"]').length,
    modal: !!document.querySelector('[data-ds="tourmaline-modal"][data-state="open"], [role="dialog"]'),
    capText: /limite|atingiu|renovado|diariamente|too frequent|limit/i.test(document.body.innerText),
    tail: (document.body.innerText||'').slice(-300)
  }));
  console.log(JSON.stringify(s,null,1));
  await b.close();
})().catch(e=>{console.log('ERR',e.message);process.exit(1);});
