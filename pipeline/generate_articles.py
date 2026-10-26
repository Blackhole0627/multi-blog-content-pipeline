"""Generate pending articles with DeepSeek, validate locally, retry on failure.

Usage: set DEEPSEEK_API_KEY, then
    python pipeline/generate_articles.py blogs/blog1-tecnologia [--limit N] [--id 007]

Only writes articles that pass check_articles.py's rules. Anything that still
fails after 2 correction rounds is left out and stays PENDENTE in controle.csv,
never published half-broken.
"""
import csv
import json
import os
import re
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from check_articles import check as validate_article  # reuse the same rules

API = "https://api.deepseek.com/chat/completions"
MODEL = "deepseek-chat"

SYSTEM_PROMPT = open(os.path.join(os.path.dirname(__file__), "article_prompt.md"),
                      encoding="utf-8").read().split("## SYSTEM\n\n```")[1].split("```")[0].strip()


def call_deepseek(messages, key):
    body = json.dumps({"model": MODEL, "messages": messages, "temperature": 0.8, "max_tokens": 4000}).encode()
    req = urllib.request.Request(API, data=body, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {key}",
    })
    with urllib.request.urlopen(req, timeout=180) as r:
        res = json.load(r)
    return res["choices"][0]["message"]["content"].strip()


def build_frontmatter(row):
    desc = f"Guia completo sobre {row['title'].lower()}."
    return (
        f'---\nid: "{row["id"]}"\ntitle: "{row["title"]}"\nslug: "{row["slug"]}"\n'
        f'category: "{row["category"]}"\ndate: "2026-09-22"\n'
        f'description: "{desc[:157]}"\nimage: ""\nimage_prompt: "{row["image_prompt"]}"\n---\n\n'
    )


def recent_titles(topics, done_ids, category, limit=5):
    titles = [t["title"] for tid, t in topics.items() if tid in done_ids and t["category"] == category]
    return "; ".join(titles[-limit:]) if titles else "nenhum ainda"


def generate_one(row, key, topics, done_ids):
    user_msg = (
        f"Categoria do blog: {row['category']}\n"
        f"Título exato do artigo: {row['title']}\n"
        f"Não repita exemplos, estatísticas ou estrutura de seção destes outros artigos já "
        f"publicados na mesma categoria: {recent_titles(topics, done_ids, row['category'])}\n\n"
        f"Escreva o artigo agora, seguindo todas as regras do system prompt."
    )
    messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_msg}]
    body = call_deepseek(messages, key)

    for attempt in range(3):
        full = build_frontmatter(row) + body
        tmp_path = None
        # validate against a throwaway file path in memory-like fashion
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f:
            f.write(full)
            tmp_path = f.name
        try:
            _, problems = validate_article(tmp_path, topics)
        finally:
            os.unlink(tmp_path)
        if not problems:
            return full, []
        if attempt == 2:
            return full, problems
        messages.append({"role": "assistant", "content": body})
        messages.append({"role": "user", "content":
                          f"O rascunho anterior tem estes problemas: {'; '.join(problems)}\n"
                          f"Reescreva o artigo inteiro corrigindo exatamente isso, mantendo o resto "
                          f"igual. Responda só com o corpo do artigo corrigido."})
        body = call_deepseek(messages, key)
    return full, problems


def main(argv):
    blog_dir = argv[0] if argv and not argv[0].startswith("--") else "blogs/blog1-tecnologia"
    limit = None
    only_id = None
    if "--limit" in argv:
        limit = int(argv[argv.index("--limit") + 1])
    if "--id" in argv:
        only_id = argv[argv.index("--id") + 1]

    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        print("DEEPSEEK_API_KEY nao definida")
        return 1

    topics = {r["id"]: r for r in csv.DictReader(open(os.path.join(blog_dir, "topics.csv"), encoding="utf-8"))}
    art_dir = os.path.join(blog_dir, "articles")
    os.makedirs(art_dir, exist_ok=True)
    done_ids = {f[:3] for f in os.listdir(art_dir) if f.endswith(".md")}

    pending = [tid for tid in topics if tid not in done_ids]
    if only_id:
        pending = [only_id] if only_id in topics else []
    if limit:
        pending = pending[:limit]

    ok = failed = 0
    for tid in pending:
        row = topics[tid]
        t0 = time.time()
        try:
            full, problems = generate_one(row, key, topics, done_ids)
        except Exception as e:
            print(f"erro {tid}: {str(e)[:150]}", flush=True)
            failed += 1
            continue
        path = os.path.join(art_dir, f"{tid}-{row['slug']}.md")
        open(path, "w", encoding="utf-8").write(full)
        secs = round(time.time() - t0)
        if problems:
            print(f"REVISAR {tid} ({secs}s): {'; '.join(problems)}", flush=True)
            failed += 1
        else:
            print(f"OK      {tid} ({secs}s)", flush=True)
            done_ids.add(tid)
            ok += 1
    print(f"\n{ok} artigos gerados e aprovados, {failed} precisam de revisao")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
