// Recover a MoreLogin browser whose CDP attach is wedged: close dead blank
// pages, and reload ONLY page targets whose renderer is actually frozen (fails
// a quick Runtime.evaluate). Healthy tabs are left untouched. Port via CDPPORT.
const http = require('http');
const PORT = process.env.CDPPORT || '56494';
function getJson(p){return new Promise((res,rej)=>{http.get('http://127.0.0.1:'+PORT+p,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej);});}
(async () => {
  const v = await getJson('/json/version');
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  let nextId = 1; const waiters = new Map();
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } });
  const rpc = (method, params, sid) => new Promise((resolve) => { const id = nextId++; waiters.set(id, resolve); ws.send(JSON.stringify(sid ? { id, method, params, sessionId: sid } : { id, method, params })); });
  await new Promise(r => ws.addEventListener('open', r));
  const t = await rpc('Target.getTargets');
  const pages = (t.result.targetInfos || []).filter(x => x.type === 'page');
  let closed = 0, reloaded = 0;
  for (const pg of pages) {
    if (!pg.url || pg.url === 'about:blank' || pg.url === '') {
      await rpc('Target.closeTarget', { targetId: pg.targetId }); closed++; continue;
    }
    const att = await rpc('Target.attachToTarget', { targetId: pg.targetId, flatten: true });
    const sid = att.result && att.result.sessionId;
    if (!sid) continue;
    const res = await Promise.race([
      rpc('Runtime.evaluate', { expression: '1+1', returnByValue: true }, sid).then(() => 'ok'),
      new Promise(r => setTimeout(() => r('HANG'), 6000)),
    ]);
    if (res === 'HANG') { await Promise.race([ rpc('Page.reload', { ignoreCache: true }, sid), new Promise(r => setTimeout(r, 3000)) ]); reloaded++; console.log('reloaded frozen tab:', pg.url.slice(0, 55)); }
    await rpc('Target.detachFromTarget', { sessionId: sid }).catch(() => {});
  }
  console.log(`unwedge: closed ${closed} blank, reloaded ${reloaded} frozen`);
  ws.close(); process.exit(0);
})().catch(e => { console.log('unwedge ERR', e.message); process.exit(1); });
