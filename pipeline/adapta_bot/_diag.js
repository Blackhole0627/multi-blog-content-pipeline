// List ALL targets (every type) and time how long each takes to attach +
// Runtime.enable over raw CDP. A target that never answers is the wedge that
// blocks Playwright's connectOverCDP.
const http = require('http');
function getJson(p){return new Promise((res,rej)=>{http.get('http://127.0.0.1:56494'+p,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej);});}
(async () => {
  const v = await getJson('/json/version');
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  let nextId = 1; const pending = new Map();
  const call = (method, params) => new Promise((resolve) => { const id = nextId++; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params, sessionId: params && params.__sid })); });
  // raw send with explicit sessionId
  const rawSend = (id, method, params, sessionId) => ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  const waiters = new Map();
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } });
  const rpc = (method, params, sessionId) => new Promise((resolve) => { const id = nextId++; waiters.set(id, resolve); rawSend(id, method, params, sessionId); });
  await new Promise(r => ws.addEventListener('open', r));
  const t = await rpc('Target.getTargets');
  const targets = t.result.targetInfos || [];
  console.log('total targets:', targets.length);
  for (const tg of targets) {
    const label = `[${tg.type}] ${tg.url.slice(0, 60)}`;
    const att = await rpc('Target.attachToTarget', { targetId: tg.targetId, flatten: true });
    const sid = att.result && att.result.sessionId;
    if (!sid) { console.log(`  SKIP (no session)  ${label}`); continue; }
    const start = Date.now();
    const res = await Promise.race([
      rpc('Runtime.enable', {}, sid).then(() => 'ok'),
      new Promise(r => setTimeout(() => r('HANG'), 8000)),
    ]);
    const ms = Date.now() - start;
    console.log(`  ${res === 'ok' ? 'ok  ' + ms + 'ms' : 'HANG >8s  <-- WEDGE'}   ${label}`);
    await rpc('Target.detachFromTarget', { sessionId: sid }).catch(() => {});
  }
  ws.close(); process.exit(0);
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
