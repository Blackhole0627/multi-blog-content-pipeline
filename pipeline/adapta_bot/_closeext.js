// Close ONLY the extension index.html page target on 56494 via raw CDP.
// Leaves the extension loaded (background persists) and every account tab intact.
const http = require('http');
function getJson(path) {
  return new Promise((res, rej) => {
    http.get('http://127.0.0.1:56494' + path, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d))); }).on('error', rej);
  });
}
(async () => {
  const v = await getJson('/json/version');
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  const send = (id, method, params) => ws.send(JSON.stringify({ id, method, params }));
  ws.addEventListener('open', () => send(1, 'Target.getTargets'));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id === 1) {
      const targets = m.result.targetInfos || [];
      const ext = targets.filter(t => t.type === 'page' && /^chrome-extension:\/\/[a-z]+\/index\.html/.test(t.url));
      if (!ext.length) { console.log('no extension index.html tab found (already closed?)'); ws.close(); process.exit(0); }
      console.log('closing ' + ext.length + ' extension tab(s):');
      ext.forEach((t, i) => { console.log('   ' + t.url.slice(0, 70)); send(100 + i, 'Target.closeTarget', { targetId: t.targetId }); });
      setTimeout(() => { ws.close(); process.exit(0); }, 2500);
    }
    if (m.id >= 100) console.log('   closed:', JSON.stringify(m.result));
  });
  ws.addEventListener('error', e => { console.log('ws error', e.message || e); process.exit(1); });
})();
