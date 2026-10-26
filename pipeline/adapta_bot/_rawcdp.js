// Raw browser-level CDP: does Target.getTargets answer at all?
const http = require('http');
function getJson(path) {
  return new Promise((res, rej) => {
    http.get('http://127.0.0.1:56494' + path, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}
(async () => {
  const v = await getJson('/json/version');
  const wsUrl = v.webSocketDebuggerUrl;
  console.log('browser ws:', wsUrl);
  const ws = new WebSocket(wsUrl);
  let answered = false;
  const t = setTimeout(() => { if (!answered) { console.log('RESULT: browser WS did NOT answer Target.getTargets in 10s -> endpoint wedged'); ws.close(); process.exit(0); } }, 10000);
  ws.addEventListener('open', () => { ws.send(JSON.stringify({ id: 1, method: 'Target.getTargets' })); });
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id === 1) {
      answered = true; clearTimeout(t);
      const pages = (m.result.targetInfos || []).filter(x => x.type === 'page');
      console.log('RESULT: browser WS answered. page targets:', pages.length);
      pages.forEach(p => console.log('   [' + (p.attached ? 'attached' : 'free') + '] ' + p.url.slice(0, 70)));
      ws.close(); process.exit(0);
    }
  });
  ws.addEventListener('error', e => { console.log('ws error', e.message || e); process.exit(1); });
})();
