// Bot 1 — article generation via DeepSeek (browser automation, no API).
// Launches Kaik's already-logged-in DeepSeek profile, and for each pending
// topics.csv row starts a fresh chat, sends SYSTEM + USER prompt, waits for the
// streamed answer to finish, and saves the raw article (markdown) to
// raw/articles/<id>.txt. Skip-and-log on failure; never crashes the batch.
//
// Usage:  node article_bot.js               (all pending)
//         node article_bot.js 001 002       (only these ids, test run)
// Env:    DEEPSEEK_PROFILE  (default: Kaik's browser_profile_deepseek)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE = process.env.DEEPSEEK_PROFILE ||
  'C:\\Users\\Administrator\\Documents\\workplace-bot2\\worker\\browser_profile_deepseek';
const ROOT = path.resolve(__dirname, '..', '..');
const BLOG = path.join(ROOT, 'blogs', process.env.BLOG_DIR || 'blog1-tecnologia');
const CSV = path.join(BLOG, 'topics.csv');
const OUT = path.join(BLOG, 'raw', 'articles');
const PROMPT_MD = path.join(ROOT, 'pipeline', 'article_prompt.md');
const LOG = path.join(__dirname, 'article_bot.log');

const GEN_TIMEOUT_MS = 240000;   // up to 4 min for one long article
const STABLE_MS = 4000;          // response considered done after this much no-growth
const PAUSE_MS = 5000;

function log(m) { const l = `${new Date().toISOString()} | ${m}`; console.log(l); try { fs.appendFileSync(LOG, l + '\n'); } catch (_) {} }

function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift().map(x => x.trim());
  return rows.filter(r => r.length > 1).map(r => { const o = {}; h.forEach((k, i) => o[k] = (r[i] ?? '').trim()); return o; });
}

function loadSystemPrompt() {
  const md = fs.readFileSync(PROMPT_MD, 'utf8');
  const m = md.split('## SYSTEM')[1];
  const block = m.match(/```([\s\S]*?)```/);
  if (!block) throw new Error('no SYSTEM block in article_prompt.md');
  let sys = block[1].trim();
  // Optional per-blog addendum appended to the SYSTEM prompt (e.g. the recipes
  // blog needs exact ingredient quantities/times/temps, which the base rules
  // would otherwise forbid). Pass its path via ARTICLE_ADDENDUM.
  const addPath = process.env.ARTICLE_ADDENDUM;
  if (addPath && fs.existsSync(addPath)) {
    sys += '\n\n' + fs.readFileSync(addPath, 'utf8').trim();
  }
  return sys;
}

function userPrompt(row) {
  return `Categoria do blog: ${row.category}\nTítulo exato do artigo: ${row.title}\n\n` +
         `Escreva o artigo agora, seguindo todas as regras do system prompt. ` +
         `IMPORTANTE: o corpo deve ter entre 2200 e 2500 palavras. Nunca menos de ` +
         `2100 nem mais de 2500. Desenvolva cada seção com profundidade, exemplos ` +
         `concretos e explicações completas, sem repetir ideias só para alongar. ` +
         `Antes de terminar, confira mentalmente se está entre 2200 e 2500 palavras ` +
         `e ajuste se precisar antes de responder.`;
}

// Rebuild markdown from the rendered assistant message (## / ### / - preserved).
async function readArticleMarkdown(page) {
  return page.evaluate(() => {
    const sels = ['.ds-assistant-message-main-content', "[data-role='assistant']", "div[class*='markdown']"];
    let root = null;
    for (const s of sels) { const els = document.querySelectorAll(s); if (els.length) { root = els[els.length - 1]; break; } }
    if (!root) return '';
    const md = (el) => {
      let out = [];
      el.childNodes.forEach(n => {
        if (n.nodeType === 3) { const t = n.textContent.trim(); if (t) out.push(t); return; }
        if (n.nodeType !== 1) return;
        const tag = n.tagName.toLowerCase();
        if (tag === 'h1') out.push('# ' + n.textContent.trim());
        else if (tag === 'h2') out.push('## ' + n.textContent.trim());
        else if (tag === 'h3') out.push('### ' + n.textContent.trim());
        else if (tag === 'h4') out.push('#### ' + n.textContent.trim());
        else if (tag === 'p') out.push(n.textContent.trim());
        else if (tag === 'ul') n.querySelectorAll(':scope > li').forEach(li => out.push('- ' + li.textContent.trim()));
        else if (tag === 'ol') { let i = 1; n.querySelectorAll(':scope > li').forEach(li => out.push((i++) + '. ' + li.textContent.trim())); }
        else if (tag === 'pre') out.push('```\n' + n.textContent.replace(/\n+$/, '') + '\n```');
        else if (tag === 'blockquote') n.querySelectorAll('p').forEach(p => out.push('> ' + p.textContent.trim()));
        else { const t = md(n); if (t) out.push(t); }
      });
      return out.join('\n\n');
    };
    return md(root).replace(/\n{3,}/g, '\n\n').trim();
  });
}

async function newChat(page) {
  await page.bringToFront().catch(() => {});
  await page.keyboard.press('Control+j');   // DeepSeek: new chat
  await page.waitForTimeout(1200);
}

async function sendPrompt(page, text) {
  const box = page.locator('textarea').first();
  await box.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(text);     // multiline stays as text (Enter would submit early)
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
}

async function assistantCount(page) {
  return page.$$eval(
    ".ds-assistant-message-main-content, [data-role='assistant'], div[class*='markdown']",
    els => els.length
  ).catch(() => 0);
}

// Wait for a NEW assistant message (count > baseCount) to appear, then for its
// text to stop growing. baseCount lets us wait for the RIGHT response after a
// follow-up (expand) prompt instead of re-reading the previous one.
async function isRateLimited(page) {
  return page.evaluate(() =>
    /too frequent|muito frequent|frequent demais|Try again later|Tente novamente mais tarde/i
      .test(document.body.innerText || '')
  ).catch(() => false);
}

async function waitForArticle(page, baseCount, maxMs) {
  const deadline = Date.now() + (maxMs || GEN_TIMEOUT_MS);
  let started = false, last = '', stableSince = 0;
  while (Date.now() < deadline) {
    if (!started) {
      if (await assistantCount(page) > baseCount) { started = true; }
      // Fail fast on the "Messages too frequent" throttle instead of waiting out
      // the full timeout — lets the wrapper rotate/sleep in seconds, not minutes.
      else if (await isRateLimited(page)) { throw new Error('rate-limited'); }
    } else {
      const cur = await readArticleMarkdown(page).catch(() => '');
      if (cur && cur === last && cur.length > 400) {
        if (!stableSince) stableSince = Date.now();
        else if (Date.now() - stableSince >= STABLE_MS) return cur;
      } else { stableSince = 0; last = cur; }
    }
    await page.waitForTimeout(1500);
  }
  if (last && last.length > 400) return last;
  throw new Error('timeout / empty article');
}

function countWords(s) { return s.split(/\s+/).filter(Boolean).length; }

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const SYSTEM = loadSystemPrompt();
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  const only = process.argv.slice(2);
  const pending = rows.filter(r => r.id && r.title &&
    (only.length === 0 || only.includes(r.id)) &&
    !fs.existsSync(path.join(OUT, `${r.id}.txt`)));
  log(`Article bot: ${pending.length} id(s) ${only.length ? '(' + only.join(',') + ')' : '(all pending)'}`);
  if (!pending.length) { log('Nothing to do.'); return; }

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, channel: 'chrome', viewport: null,
    args: ['--disable-blink-features=AutomationControlled'], ignoreDefaultArgs: ['--enable-automation'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://chat.deepseek.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);
  if (!(await page.locator('textarea').count())) { log('ERROR: not logged in / no chat input'); await ctx.close(); return; }
  log('DeepSeek ready.');

  let ok = 0, fail = 0;
  for (const r of pending) {
    const dest = path.join(OUT, `${r.id}.txt`);
    try {
      await newChat(page);
      log(`[${r.id}] "${r.title.slice(0, 55)}..."`);
      let base = await assistantCount(page);
      await sendPrompt(page, SYSTEM + '\n\n' + userPrompt(r));
      let article = await waitForArticle(page, base);
      let words = countWords(article);
      // Length gate (speed-tuned): over-long articles are COMPLETE and the
      // separate validation pass trims them, so never spend time re-shortening.
      // Only genuinely THIN articles (< FLOOR) get ONE quick expand rewrite,
      // capped short so a hung/throttled rewrite can't burn the full 4 minutes.
      const FLOOR = 2000;
      if (words < FLOOR) {
        log(`[${r.id}] ${words} words < ${FLOOR} — one expand rewrite`);
        base = await assistantCount(page);
        await sendPrompt(page,
          `Ficou com cerca de ${words} palavras, curto demais. Reescreva o artigo ` +
          `INTEIRO com 2200 a 2500 palavras, desenvolvendo mais cada seção com ` +
          `exemplos concretos e explicações, mantendo o mesmo título, estrutura ` +
          `e regras. Responda só com o corpo completo do artigo em Markdown.`);
        try {
          const redo = await waitForArticle(page, base, 120000);   // short cap, not 4 min
          const w2 = countWords(redo);
          if (w2 > words) { article = redo; words = w2; }           // keep the fuller version
        } catch (e) { log(`[${r.id}] expand rewrite skipped (${e.message}) — keeping ${words}w`); }
      }
      fs.writeFileSync(dest, article, 'utf8');
      log(`[${r.id}] OK -> raw/articles/${r.id}.txt (${words} words)`);
      ok++;
    } catch (e) { log(`[${r.id}] FAIL: ${e.message}`); fail++; }
    await page.waitForTimeout(PAUSE_MS);
  }
  log(`Done. ok=${ok} fail=${fail}`);
  await ctx.close();
})().catch(e => { log('FATAL ' + (e.stack || e.message)); process.exit(1); });
