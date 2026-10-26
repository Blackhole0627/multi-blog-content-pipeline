// Reload ONLY the hung Gmail #inbox tab (the one whose renderer is frozen) via raw CDP.
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
  // The wedge is the plain #inbox tab (ends with /#inbox), NOT the one with a message id.
  const target = (t.result.targetInfos || []).find(x => x.type === 'page' && /mail\.google\.com\/mail\/u\/0\/#inbox$/.test(x.url));
  if (!target) { console.log('hung Gmail #inbox tab not found (already cleared?)'); ws.close(); process.exit(0); }
  console.log('reloading:', target.url);
  const att = await rpc('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const sid = att.result.sessionId;
  // ignoreCache reload = fresh renderer. Don't wait on it (page is hung); fire and give it a moment.
  await Promise.race([ rpc('Page.reload', { ignoreCache: true }, sid), new Promise(r => setTimeout(r, 4000)) ]);
  console.log('reload sent.');
  setTimeout(() => { ws.close(); process.exit(0); }, 1500);
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
