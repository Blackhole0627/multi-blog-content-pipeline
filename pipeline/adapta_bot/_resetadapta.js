// Hard-reset the Adapta chat tab: close the frozen one, open a fresh tab on the
// same chat URL (server-side history intact), then poll until responsive.
const http = require('http');
const CHAT = 'https://agent.adapta.one/agentic-chat/01a0dd99-4001-7146-b48b-8b33f2fcba21';
function getJson(p){return new Promise((res,rej)=>{http.get('http://127.0.0.1:56494'+p,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej);});}
(async () => {
  const v = await getJson('/json/version');
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  let nextId = 1; const waiters = new Map();
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } });
  const rpc = (method, params, sessionId) => new Promise((resolve) => { const id = nextId++; waiters.set(id, resolve); ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params })); });
  await new Promise(r => ws.addEventListener('open', r));
  let t = await rpc('Target.getTargets');
  const frozen = (t.result.targetInfos || []).filter(x => x.type === 'page' && x.url.includes('agent.adapta.one/agentic-chat'));
  for (const f of frozen) { console.log('closing frozen tab', f.targetId); await rpc('Target.closeTarget', { targetId: f.targetId }); }
  await new Promise(r => setTimeout(r, 1500));
  console.log('opening fresh tab ->', CHAT);
  await rpc('Target.createTarget', { url: CHAT });
  // poll for responsive
  const deadline = Date.now() + 75000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000));
    t = await rpc('Target.getTargets');
    const tg = (t.result.targetInfos || []).find(x => x.type === 'page' && x.url.includes('agent.adapta.one/agentic-chat'));
    if (!tg) continue;
    const att = await rpc('Target.attachToTarget', { targetId: tg.targetId, flatten: true });
    const sid = att.result.sessionId;
    const res = await Promise.race([
      rpc('Runtime.evaluate', { expression: 'document.querySelectorAll(\'img[alt="Generated image"]\').length', returnByValue: true }, sid).then(r => r.result && r.result.result && r.result.result.value),
      new Promise(r => setTimeout(() => r('HANG'), 6000)),
    ]);
    await rpc('Target.detachFromTarget', { sessionId: sid }).catch(() => {});
    if (res !== 'HANG') { console.log('RESPONSIVE. generated-image count =', res); ws.close(); process.exit(0); }
    console.log('  ...still loading');
  }
  console.log('fresh tab still not responsive after 75s'); ws.close(); process.exit(2);
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
