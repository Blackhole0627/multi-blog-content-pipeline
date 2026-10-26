// Poll until the Adapta chat page answers Runtime.evaluate (renderer alive), up to 60s.
const http = require('http');
function getJson(p){return new Promise((res,rej)=>{http.get('http://127.0.0.1:56494'+p,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej);});}
(async () => {
  const v = await getJson('/json/version');
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  let nextId = 1; const waiters = new Map();
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } });
  const rpc = (method, params, sessionId) => new Promise((resolve) => { const id = nextId++; waiters.set(id, resolve); ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params })); });
  await new Promise(r => ws.addEventListener('open', r));
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const t = await rpc('Target.getTargets');
    const tg = (t.result.targetInfos || []).find(x => x.type === 'page' && x.url.includes('agent.adapta.one/agentic-chat'));
    if (tg) {
      const att = await rpc('Target.attachToTarget', { targetId: tg.targetId, flatten: true });
      const sid = att.result.sessionId;
      const res = await Promise.race([
        rpc('Runtime.evaluate', { expression: 'document.querySelectorAll(\'img[alt="Generated image"]\').length', returnByValue: true }, sid).then(r => r.result && r.result.result && r.result.result.value),
        new Promise(r => setTimeout(() => r('HANG'), 6000)),
      ]);
      await rpc('Target.detachFromTarget', { sessionId: sid }).catch(() => {});
      if (res !== 'HANG') { console.log('RESPONSIVE. generated-image count on page =', res); ws.close(); process.exit(0); }
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  console.log('still not responsive after 60s'); ws.close(); process.exit(2);
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
