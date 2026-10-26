// Reload the frozen Adapta agentic-chat page via raw CDP to get a fresh renderer.
const http = require('http');
function getJson(p){return new Promise((res,rej)=>{http.get('http://127.0.0.1:56494'+p,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej);});}
(async () => {
  const v = await getJson('/json/version');
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  let nextId = 1; const waiters = new Map();
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } });
  const rpc = (method, params, sessionId) => new Promise((resolve) => { const id = nextId++; waiters.set(id, resolve); ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params })); });
  await new Promise(r => ws.addEventListener('open', r));
  const t = await rpc('Target.getTargets');
  const target = (t.result.targetInfos || []).find(x => x.type === 'page' && x.url.includes('agent.adapta.one/agentic-chat'));
  if (!target) { console.log('adapta chat page not found'); ws.close(); process.exit(1); }
  console.log('reloading:', target.url);
  const att = await rpc('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const sid = att.result.sessionId;
  await Promise.race([ rpc('Page.reload', { ignoreCache: true }, sid), new Promise(r => setTimeout(r, 4000)) ]);
  console.log('reload sent.');
  setTimeout(() => { ws.close(); process.exit(0); }, 1500);
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
