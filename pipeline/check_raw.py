# -*- coding: utf-8 -*-
"""Audit the raw bot output of one blog before it is organized and published.

Usage: python pipeline/check_raw.py blogs/blog1-tecnologia

Checks raw/articles/<id>.txt and raw/images/<id>.jpg against topics.csv:
length, banned punctuation, chatbot leftovers, structure, duplicated content
between articles, and image validity and duplicates. Prints a report only.
"""
import csv
import hashlib
import os
import re
import sys
from collections import Counter, defaultdict

MIN_WORDS, MAX_WORDS, FLOOR = 2100, 2400, 1500
BAD_CHARS = {"—": "travessao", "–": "meia-risca"}
EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF☀-➿]")
CITATION_RE = re.compile(r"\s-\d+(-\d+)?(?=\.)")
CLICHES = ["no mundo de hoje", "em constante evolução", "é importante ressaltar", "vale destacar",
           "em resumo", "em suma", "desbloquear", "revolucionar", "mergulhar"]
LEFTOVER_RE = re.compile(r"^(claro|com certeza|aqui está|segue|certo|perfeito|ok)[!,. ]", re.I)
TRAILER_RE = re.compile(r"(quer que eu|posso (ajustar|gerar|escrever)|deseja que|se precisar de|copiar|regenerate|deepseek)", re.I)


def words(text):
    return len(text.split())


def shingles(text, n=6):
    toks = re.findall(r"\w+", text.lower())
    return {" ".join(toks[i:i + n]) for i in range(len(toks) - n + 1)}


def main(blog):
    topics = list(csv.DictReader(open(os.path.join(blog, "topics.csv"), encoding="utf-8")))
    raw_a = os.path.join(blog, "raw", "articles")
    raw_i = os.path.join(blog, "raw", "images")
    problems = defaultdict(list)
    texts = {}
    wc = {}

    for t in topics:
        tid = t["id"]
        p = os.path.join(raw_a, tid + ".txt")
        if not os.path.exists(p):
            problems[tid].append("artigo ausente")
            continue
        body = open(p, encoding="utf-8").read().strip()
        texts[tid] = body
        n = words(body)
        wc[tid] = n
        if n < FLOOR:
            problems[tid].append(f"muito curto ({n})")
        elif n < MIN_WORDS:
            problems[tid].append(f"abaixo do alvo ({n})")
        elif n > MAX_WORDS + 300:
            problems[tid].append(f"muito longo ({n})")
        for ch, name in BAD_CHARS.items():
            if ch in body:
                problems[tid].append(f"{name} x{body.count(ch)}")
        if EMOJI_RE.search(body):
            problems[tid].append("emoji")
        cit = len(CITATION_RE.findall(body))
        if cit:
            problems[tid].append(f"marcador de citacao sobrando x{cit}")
        hits = [c for c in CLICHES if c in body.lower()]
        if hits:
            problems[tid].append("cliches: " + ", ".join(hits))
        first = body.splitlines()[0] if body else ""
        if LEFTOVER_RE.match(first):
            problems[tid].append("abre com resposta de chatbot: " + first[:50])
        if TRAILER_RE.search(body[-400:]):
            problems[tid].append("termina com resto de chatbot")
        if re.search(r"^---\s*$", body, re.M) and body.lstrip().startswith("---"):
            problems[tid].append("tem frontmatter")
        if re.search(r"^# ", body, re.M):
            problems[tid].append("H1 no corpo")
        h2 = len(re.findall(r"^## ", body, re.M))
        if h2 < 5 or h2 > 10:
            problems[tid].append(f"secoes H2 = {h2}")
        if "**" in body and len(re.findall(r"\*\*", body)) > 60:
            problems[tid].append("muito negrito")

    # duplicated content between articles
    sh = {tid: shingles(tx) for tid, tx in texts.items()}
    ids = sorted(sh)
    dup_pairs = []
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            inter = len(sh[a] & sh[b])
            if inter:
                j = inter / max(1, min(len(sh[a]), len(sh[b])))
                if j > 0.03:
                    dup_pairs.append((round(j, 3), a, b))
    dup_pairs.sort(reverse=True)

    # repeated openings and closings
    opens = Counter(tx.split("\n")[0][:60] for tx in texts.values())
    rep_open = [(o, c) for o, c in opens.items() if c > 1]
    h2s = Counter(h for tx in texts.values() for h in re.findall(r"^## (.+)$", tx, re.M))
    rep_h2 = [(h, c) for h, c in h2s.most_common(12) if c >= 5]

    # images
    img_issues = defaultdict(list)
    hashes = defaultdict(list)
    try:
        from PIL import Image
    except ImportError:
        Image = None
    for t in topics:
        tid = t["id"]
        p = next((os.path.join(raw_i, tid + e) for e in (".jpg", ".jpeg", ".png", ".webp")
                  if os.path.exists(os.path.join(raw_i, tid + e))), None)
        if not p:
            img_issues[tid].append("imagem ausente")
            continue
        data = open(p, "rb").read()
        hashes[hashlib.md5(data).hexdigest()].append(tid)
        if len(data) < 15000:
            img_issues[tid].append(f"arquivo pequeno ({len(data)} bytes)")
        if Image:
            try:
                im = Image.open(p)
                im.load()
                w, h = im.size
                if w < 800 or h < 400:
                    img_issues[tid].append(f"resolucao baixa {w}x{h}")
            except Exception as e:
                img_issues[tid].append("corrompida: " + str(e)[:40])
    dup_imgs = [v for v in hashes.values() if len(v) > 1]

    # report
    print(f"ARTIGOS: {len(texts)} de {len(topics)} presentes")
    if wc:
        vals = sorted(wc.values())
        print(f"palavras min/mediana/max: {vals[0]} / {vals[len(vals)//2]} / {vals[-1]}")
    bad = {k: v for k, v in problems.items() if v}
    print(f"artigos com problema: {len(bad)}")
    kinds = Counter(p.split(" (")[0].split(":")[0].split(" x")[0] for v in bad.values() for p in v)
    for k, c in kinds.most_common():
        print(f"   {c:3}  {k}")
    for tid in sorted(bad)[:25]:
        print(f"  {tid}: {'; '.join(bad[tid])[:140]}")
    if len(bad) > 25:
        print(f"  ... mais {len(bad) - 25}")
    print(f"\nCONTEUDO DUPLICADO entre artigos (pares acima de 3% de trechos iguais): {len(dup_pairs)}")
    for j, a, b in dup_pairs[:12]:
        print(f"   {a} x {b}  {j*100:.1f}%")
    print(f"aberturas repetidas: {len(rep_open)}")
    for o, c in rep_open[:8]:
        print(f"   {c}x  {o}")
    print(f"titulos de secao repetidos em 5+ artigos: {len(rep_h2)}")
    for h, c in rep_h2:
        print(f"   {c}x  {h}")
    print(f"\nIMAGENS: {len(topics) - sum(1 for t in topics if 'imagem ausente' in img_issues[t['id']])} de {len(topics)} presentes")
    ib = {k: v for k, v in img_issues.items() if v}
    print(f"imagens com problema: {len(ib)}")
    for tid in sorted(ib)[:15]:
        print(f"  {tid}: {'; '.join(ib[tid])}")
    print(f"imagens identicas (mesmo arquivo): {dup_imgs}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "blogs/blog1-tecnologia")
