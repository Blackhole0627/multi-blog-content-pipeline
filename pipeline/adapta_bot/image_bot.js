// Bot 2 — image generation via Adapta One (browser automation, no API).
// Connects to the already-logged-in Adapta tab inside Kaik's MoreLogin over
// CDP, sends one image prompt per pending topics.csv row, waits for the
// generated image, downloads it to raw/images/<id>.jpg. Skip-and-log on
// failure; never crashes the batch.
//
// Usage:
//   node image_bot.js                 # all pending ids
//   node image_bot.js 001 002 003     # only these ids (test run)
// Env:
//   ADAPTA_CDP   CDP endpoint of Kaik's MoreLogin (default http://127.0.0.1:53821)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CDP = process.env.ADAPTA_CDP || 'http://127.0.0.1:53821';
const CHAT_URL = process.env.ADAPTA_CHAT_URL ||
  'https://agent.adapta.one/agentic-chat/01a0b486-3006-75c8-8246-e3f9e0323245';
const ROOT = path.resolve(__dirname, '..', '..');           // project root
const BLOG = path.join(ROOT, 'blogs', process.env.BLOG_DIR || 'blog1-tecnologia');
const CSV = path.join(BLOG, 'topics.csv');
const OUT = path.join(BLOG, 'raw', 'images');
const TEMPLATE_MD = path.join(ROOT, 'pipeline', 'image_prompt_template.md');
const LOG = path.join(__dirname, 'image_bot.log');

const GEN_TIMEOUT_MS = 180000;   // wait up to 3 min for one image
const PAUSE_MS = 6000;           // gap between ids (looks human, avoids rate limits)
const HARD_ID_MS = 220000;       // absolute cap per id — bounds a frozen renderer (no 14-min hangs)

// Timer-based sleep that never depends on a (possibly-dead) page.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Race a promise against a wall-clock timeout so a hung page call can't stall forever.
function withTimeout(promise, ms, label) {
  let t;
  const guard = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`watchdog ${label} > ${Math.round(ms / 1000)}s`)), ms); });
  return Promise.race([promise, guard]).finally(() => clearTimeout(t));
}
const isPageDead = (msg) => /has been closed|Target closed|Target page, context or browser|websocket|Connection closed|browser has been closed/i.test(msg || '');

function log(msg) {
  const line = `${new Date().toISOString()} | ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + '\n'); } catch (_) {}
}

// Minimal CSV parser that respects double-quoted fields (image_prompt_pt has commas).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map(h => h.trim());
  return rows.filter(r => r.length > 1).map(r => {
    const o = {};
    header.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); });
    return o;
  });
}

function loadTemplate() {
  const md = fs.readFileSync(TEMPLATE_MD, 'utf8');
  const m = md.match(/```([\s\S]*?)```/);      // first fenced block
  if (!m) throw new Error('no template block in image_prompt_template.md');
  return m[1].trim();
}

async function startFreshChat(page) {
  // The single long chat gets heavy (100+ images) and can stick on a
  // clarifying widget. Opening a new chat gives a clean, fast context.
  await page.bringToFront().catch(() => {});
  const btn = page.getByRole('button', { name: /Novo chat/i }).first();
  if (await btn.count().catch(() => 0)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(3500);
  }
}

async function findChatPage(browser) {
  const pages = [];
  for (const ctx of browser.contexts())
    for (const p of ctx.pages())
      if (p.url().includes('adapta.one')) pages.push(p);
  const targetId = CHAT_URL.split('/').pop();
  // Prefer a tab already on the TARGET chat, else navigate one there.
  let page = pages.find(p => p.url().includes(targetId));
  if (!page && pages.length) {
    page = pages.find(p => /agentic-chat\/[0-9a-f]{8}/i.test(p.url())) || pages[0];
    await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }
  return page || null;
}

async function genImageCount(page) {
  return page.$$eval('img[alt="Generated image"]', els => els.length).catch(() => 0);
}

// The real (http) src URLs of every generated image currently in the DOM. Each
// generation gets a UNIQUE url, so comparing url sets — not counts — is what
// reliably identifies the NEW image and avoids grabbing a previous one.
async function genImageSrcs(page) {
  return page.$$eval('img[alt="Generated image"]',
    els => els.map(e => e.src).filter(s => s && s.startsWith('http'))
  ).catch(() => []);
}

async function sendPrompt(page, prompt) {
  // CRITICAL: the editor treats a newline as SUBMIT, so a multi-line prompt
  // gets sent line by line (only the first line reaches the agent). Collapse
  // to ONE line so the whole prompt — subject included — arrives as one message.
  const oneLine = prompt.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  // Dismiss Adapta's promo/onboarding modal ("Experimente o Adapta ONE ...") if
  // present — its overlay intercepts pointer events and blocks the composer.
  const closeModal = page.locator(
    '[data-ds="tourmaline-modal"][data-state="open"] button[aria-label="Fechar" i], [role="dialog"] button[aria-label="Fechar" i]'
  ).first();
  if (await closeModal.count().catch(() => 0)) { await closeModal.click().catch(() => {}); await page.waitForTimeout(600); }
  const notNow = page.getByRole('button', { name: /Agora n[ãa]o/i }).first();
  if (await notNow.count().catch(() => 0)) { await notNow.click().catch(() => {}); await page.waitForTimeout(600); }
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  await page.waitForTimeout(300);
  // Dismiss any open clarifying widget ("Pular" = skip) and clear the composer.
  const skip = page.getByRole('button', { name: /Pular/i }).first();
  if (await skip.count().catch(() => 0)) { await skip.click().catch(() => {}); await page.waitForTimeout(500); }
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(oneLine);   // paste-like: no per-char Enter risk
  await page.waitForTimeout(500);
  // Submit with retries — Enter can be mistimed when the page is busy/heavy.
  const submitted = async () => (await editor.innerText().catch(() => '')).trim().length <= 20;
  for (let i = 0; i < 5; i++) {
    await editor.click();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1400);
    if (await submitted()) return;
    const sendBtn = page.locator(
      'button[aria-label*="Enviar" i], button[data-testid*="send" i], button[type="submit"], button[aria-label*="Send" i]'
    ).first();
    if (await sendBtn.count().catch(() => 0)) { await sendBtn.click().catch(() => {}); await page.waitForTimeout(1200); if (await submitted()) return; }
    await page.waitForTimeout(800);
  }
  throw new Error('could not submit prompt after retries');
}

// Count the daily-cap notices currently on the page. Comparing this before/after
// a send (delta) detects a NEW cap message — not a stale one from history — so
// detection still works after the 00:01 reset.
async function capCount(page) {
  return page.evaluate(() => {
    // Covers Adapta's cap-message variants, incl. "as criações voltam ... Pode
    // tentar novamente depois das 00:01" (the daily reset) and the older phrasings.
    const m = (document.body.innerText || '').match(/limite de gera[çc][ãa]o|atingiu o limite|renovado diariamente|limite di[áa]rio|cria[çc][õo]es voltam|tentar novamente depois das|depois das 00:0|voltam com qualidade|daily.{0,10}limit|reached.{0,15}limit/gi);
    return m ? m.length : 0;
  }).catch(() => 0);
}

async function waitForNewImage(page, beforeSet, capBefore) {
  // Wait for a generated-image src that was NOT present before we sent the
  // prompt. Comparing url sets (instead of counts + "last element") means we
  // never download a previous article's image when the new one is slow to
  // render under Adapta's virtualized scroll. Require the candidate to persist
  // one extra poll so we capture the final url, not a transient/placeholder.
  const deadline = Date.now() + GEN_TIMEOUT_MS;
  let candidate = '', stable = 0;
  while (Date.now() < deadline) {
    const srcs = await genImageSrcs(page);
    const fresh = srcs.filter(s => !beforeSet.has(s));
    if (fresh.length) {
      const newest = fresh[fresh.length - 1];
      if (newest === candidate) { if (++stable >= 2) return newest; }
      else { candidate = newest; stable = 0; }
    } else if (await capCount(page) > (capBefore || 0)) {
      // Adapta replied with a NEW "daily image limit reached" notice — no point
      // waiting the full timeout, and every other id is capped too.
      throw new Error('image-cap');
    }
    await page.waitForTimeout(2500);
  }
  throw new Error('timeout waiting for generated image');
}

async function downloadImage(page, url, dest) {
  // Fetch inside the page context (Adapta auth cookies apply), then re-encode
  // to real JPEG via canvas — Adapta serves PNG, but the spec wants <id>.jpg.
  const b64 = await page.evaluate(async (u) => {
    const r = await fetch(u);
    if (!r.ok) throw new Error('fetch ' + r.status);
    const blob = await r.blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width; canvas.height = bmp.height;
    canvas.getContext('2d').drawImage(bmp, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, url);
  fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const template = loadTemplate();
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  const onlyIds = process.argv.slice(2);
  const pending = rows.filter(r => r.id && r.image_prompt_pt &&
    (onlyIds.length === 0 || onlyIds.includes(r.id)) &&
    !fs.existsSync(path.join(OUT, `${r.id}.jpg`)));

  log(`Image bot: ${pending.length} id(s) to process ${onlyIds.length ? '(' + onlyIds.join(',') + ')' : '(all pending)'}`);
  if (!pending.length) { log('Nothing to do.'); return; }

  const browser = await chromium.connectOverCDP(CDP, { timeout: 60000 });
  const page = await findChatPage(browser);
  if (!page) { log('ERROR: no Adapta agentic-chat tab found in the browser.'); await browser.close(); return; }
  await page.bringToFront().catch(() => {});
  log(`Connected. Chat: ${page.url()}`);

  let ok = 0, fail = 0, consecTimeout = 0;
  for (const r of pending) {
    const prompt = template.replace('[ASSUNTO]', r.image_prompt_pt);
    const dest = path.join(OUT, `${r.id}.jpg`);
    try {
      // Whole-id watchdog: if the Adapta renderer freezes, this rejects at
      // HARD_ID_MS instead of blocking indefinitely on a hung page call.
      await withTimeout((async () => {
        const beforeSet = new Set(await genImageSrcs(page));   // urls already present
        const capBefore = await capCount(page);                // daily-cap notices before send
        log(`[${r.id}] sending prompt (${r.image_prompt_pt.slice(0, 50)}...)`);
        await sendPrompt(page, prompt);
        const src = await waitForNewImage(page, beforeSet, capBefore);
        await downloadImage(page, src, dest);
      })(), HARD_ID_MS, r.id);
      const kb = Math.round(fs.statSync(dest).size / 1024);
      log(`[${r.id}] OK -> ${path.relative(ROOT, dest)} (${kb} KB)`);
      ok++; consecTimeout = 0;
    } catch (e) {
      log(`[${r.id}] FAIL: ${e.message}`);
      fail++;
      // Explicit daily-cap banner — stop; wrapper retries after reset.
      if (/image-cap/.test(e.message)) { log('daily image cap reached — stopping run (wrapper will retry after reset)'); break; }
      // Quota can also exhaust SILENTLY: generations just time out with no banner.
      // After a few consecutive timeouts, stop so the wrapper sleeps/retries later
      // instead of grinding every remaining id for 3 min each.
      if (/timeout waiting for generated image|watchdog/.test(e.message)) {
        if (++consecTimeout >= 3) { log(`${consecTimeout} consecutive timeouts — generation exhausted/stuck, stopping run (wrapper will retry later)`); break; }
      } else { consecTimeout = 0; }
      // If the tab/renderer died, this process can't continue — exit cleanly so
      // the restart wrapper relaunches us on the respawned tab (skips saved ids).
      if (isPageDead(e.message)) { log('page/browser closed — exiting for wrapper restart'); break; }
    }
    await sleep(PAUSE_MS);   // timer-based; never depends on the page
  }
  log(`Done. ok=${ok} fail=${fail}`);
  await browser.close(); // CDP disconnect only
})().catch(e => { log('FATAL ' + e.stack); process.exit(1); });
