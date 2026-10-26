"""Check generated articles against STYLE.md and build the control sheet.

Usage: python pipeline/check_articles.py blogs/blog1-tecnologia
Writes <blog>/controle.csv and prints a summary. Exit code 1 if any article fails.
"""
import csv
import os
import re
import sys

MIN_WORDS = 2100
MAX_WORDS = 2400
HARD_FLOOR = 2000
BAD_CHARS = {"—": "travessao", "–": "meia-risca"}
EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF☀-➿]")
CITATION_RE = re.compile(r"\s-\d+(-\d+)?(?=\.)")
CLICHES = [
    "no mundo de hoje", "em constante evolução", "é importante ressaltar",
    "vale destacar", "em resumo", "em suma", "desbloquear", "revolucionar", "mergulhar",
]


def parse(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return None, text
    fm = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            fm[k.strip()] = v.strip().strip('"')
    return fm, m.group(2)


def has_image(img_dir, article_id):
    if not img_dir or not article_id:
        return False
    return any(os.path.exists(os.path.join(img_dir, article_id + ext))
               for ext in (".jpg", ".jpeg", ".png", ".webp"))


def check(path, topics, img_dir=None):
    fm, body = parse(path)
    problems = []
    if fm is None:
        return {"file": os.path.basename(path), "words": 0, "status": "SEM_FRONTMATTER"}, ["frontmatter ausente"]
    words = len(body.split())
    if words < HARD_FLOOR:
        problems.append(f"muito curto ({words})")
    elif words < MIN_WORDS:
        problems.append(f"abaixo do alvo ({words})")
    elif words > MAX_WORDS + 200:
        problems.append(f"muito longo ({words})")
    for ch, name in BAD_CHARS.items():
        if ch in body or ch in fm.get("title", ""):
            problems.append(name)
    if EMOJI_RE.search(body):
        problems.append("emoji")
    cit = len(CITATION_RE.findall(body))
    if cit:
        problems.append(f"marcador de citacao sobrando x{cit}")
    low = body.lower()
    hits = [c for c in CLICHES if c in low]
    if hits:
        problems.append("cliches: " + ", ".join(hits))
    if re.search(r"^# ", body, re.M):
        problems.append("H1 no corpo")
    t = topics.get(fm.get("id"))
    if t:
        if fm.get("title") != t["title"]:
            problems.append("titulo difere do topics.csv")
        if fm.get("category") != t["category"]:
            problems.append("categoria difere do topics.csv")
    else:
        problems.append("id nao encontrado no topics.csv")
    for key in ("title", "slug", "category", "date", "description", "image_prompt"):
        if not fm.get(key):
            problems.append(f"frontmatter sem {key}")
    h2 = len(re.findall(r"^## ", body, re.M))
    img_ok = has_image(img_dir, fm.get("id", ""))
    status = "OK" if not problems else "REVISAR"
    row = {
        "id": fm.get("id", ""),
        "categoria": fm.get("category", ""),
        "titulo": fm.get("title", ""),
        "arquivo": os.path.basename(path),
        "palavras": words,
        "secoes_h2": h2,
        "imagem": fm.get("image", ""),
        "imagem_gerada": "SIM" if img_ok else "NAO",
        "status": status,
        "pronto_para_publicar": "SIM" if status == "OK" and img_ok else "NAO",
        "problemas": "; ".join(problems),
        "url_publicada": "",
    }
    return row, problems


def main(blog_dir):
    topics = {}
    with open(os.path.join(blog_dir, "topics.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            topics[r["id"]] = r
    rows = []
    failed = 0
    art_dir = os.path.join(blog_dir, "articles")
    img_dir = os.path.join(blog_dir, "images")
    for name in sorted(os.listdir(art_dir)):
        if not name.endswith(".md"):
            continue
        row, problems = check(os.path.join(art_dir, name), topics, img_dir)
        rows.append(row)
        if problems:
            failed += 1
        img_tag = "img ok" if row["imagem_gerada"] == "SIM" else "SEM IMAGEM"
        print(f"{row['status']:8} {row['palavras']:5}w  {img_tag:11} {name}  {row['problemas']}")
    done_ids = {r["id"] for r in rows}
    no_image_yet = 0
    for tid, t in topics.items():
        if tid not in done_ids:
            img_ok = has_image(img_dir, tid)
            rows.append({"id": tid, "categoria": t["category"], "titulo": t["title"], "arquivo": "",
                         "palavras": 0, "secoes_h2": 0, "imagem": "", "imagem_gerada": "SIM" if img_ok else "NAO",
                         "status": "PENDENTE", "pronto_para_publicar": "NAO",
                         "problemas": "", "url_publicada": ""})
    rows.sort(key=lambda r: r["id"])
    out = os.path.join(blog_dir, "controle.csv")
    with open(out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    total = len([r for r in rows if r["arquivo"]])
    ready = len([r for r in rows if r["pronto_para_publicar"] == "SIM"])
    print(f"\n{total} artigos verificados, {failed} para revisar, {len(topics) - total} pendentes, "
          f"{ready} prontos para publicar (artigo OK + imagem gerada). Planilha: {out}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "blogs/blog1-tecnologia"))
