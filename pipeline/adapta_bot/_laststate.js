const http = require('http');
const PORT = process.env.CDPPORT || '51956';
function getJson(p){return new Promise((res,rej)=>{http.get('http://127.0.0.1:'+PORT+p,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej);});}
(async () => {
  const v = await getJson('/json/version');
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  let nextId=1; const w=new Map();
  ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&w.has(m.id)){w.get(m.id)(m);w.delete(m.id);}});
  const rpc=(method,params,sid)=>new Promise(r=>{const id=nextId++;w.set(id,r);ws.send(JSON.stringify(sid?{id,method,params,sessionId:sid}:{id,method,params}));});
  await new Promise(r=>ws.addEventListener('open',r));
  const t=await rpc('Target.getTargets');
  const tg=(t.result.targetInfos||[]).find(x=>x.type==='page'&&x.url.includes('agentic-chat'));
  const att=await rpc('Target.attachToTarget',{targetId:tg.targetId,flatten:true});
  const sid=att.result.sessionId;
  const r=await rpc('Runtime.evaluate',{expression:`(()=>{
    const txt=document.body.innerText||'';
    const limit=/limite|atingid|renovado|diariamente|daily.{0,10}limit|reached.{0,15}limit/i.test(txt);
    const tail=txt.slice(-600);
    const imgs=document.querySelectorAll('img[alt="Generated image"]').length;
    return JSON.stringify({limitWordPresent:limit, imgsInDom:imgs, tail});
  })()`,returnByValue:true},sid);
  console.log(r.result.result.value);
  ws.close();process.exit(0);
})().catch(e=>{console.log('ERR',e.message);process.exit(1);});
