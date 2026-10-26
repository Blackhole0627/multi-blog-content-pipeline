// Reload the specific frozen account tabs (Gmail #inbox, 99freelas inbox) whose
// renderers hang Playwright's attach. Server-side sessions are preserved; a
// reload just gives each a fresh renderer. Adapta tab is left untouched.
const http = require('http');
const PORT = process.env.CDPPORT || '56494';
// Reload any account tab whose renderer has frozen (these wedge Playwright's
// attach). Broad list: the tabs we've seen freeze under load. Adapta tab is
// never matched here (handled separately), so generation history is untouched.
const PATTERNS = [/mail\.google\.com/, /99freelas\.com\.br/, /workana\.com/, /app\.grey\.co/];
function getJson(p){return new Promise((res,rej)=>{http.get('http://127.0.0.1:'+PORT+p,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej);});}
(async () => {
  const v = await getJson('/json/version');
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  let nextId = 1; const waiters = new Map();
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } });
  const rpc = (method, params, sessionId) => new Promise((resolve) => { const id = nextId++; waiters.set(id, resolve); ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params })); });
  await new Promise(r => ws.addEventListener('open', r));
  const t = await rpc('Target.getTargets');
  const targets = (t.result.targetInfos || []).filter(x => x.type === 'page' && PATTERNS.some(re => re.test(x.url)));
  if (!targets.length) { console.log('no matching hung tabs found'); ws.close(); process.exit(0); }
  for (const tg of targets) {
    console.log('reloading:', tg.url.slice(0, 60));
    const att = await rpc('Target.attachToTarget', { targetId: tg.targetId, flatten: true });
    await Promise.race([ rpc('Page.reload', { ignoreCache: true }, att.result.sessionId), new Promise(r => setTimeout(r, 4000)) ]);
  }
  console.log('reloads sent.');
  setTimeout(() => { ws.close(); process.exit(0); }, 1500);
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
