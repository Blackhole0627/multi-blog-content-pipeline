const http = require('http');
const PORT = process.env.CDPPORT || '56494';
function getJson(p){return new Promise((res,rej)=>{http.get('http://127.0.0.1:'+PORT+p,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej);});}
(async () => {
  const v = await getJson('/json/version');
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  let nextId = 1; const waiters = new Map();
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } });
  const rpc = (method, params) => new Promise((resolve) => { const id = nextId++; waiters.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
  await new Promise(r => ws.addEventListener('open', r));
  const t = await rpc('Target.getTargets');
  const blanks = (t.result.targetInfos || []).filter(x => x.type === 'page' && (!x.url || x.url === 'about:blank' || x.url === ''));
  for (const b of blanks) { const r = await rpc('Target.closeTarget', { targetId: b.targetId }); console.log('closed blank page', b.targetId.slice(0,8), JSON.stringify(r.result)); }
  if (!blanks.length) console.log('no blank page found');
  ws.close(); process.exit(0);
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
