# -*- coding: utf-8 -*-
"""Build the final .md post + validate + commit straight to the blog's GitHub repo.

Usage:
    GITHUB_TOKEN=... python pipeline/push_github.py blogs/blog1-tecnologia kuriel23/kaique_blog_1_tecnologia [--only 001,002] [--limit 5] [--dry-run]

Reads raw/articles/<id>.txt + topics.csv + links.csv (id,direct_url,...), builds a
.md file matching src/content.config.ts exactly, and PUTs it to
src/content/posts/<id>-<slug>.md via the GitHub Contents API. One commit per file.
Skips any id whose post file already exists in the repo (safe to re-run).
"""
import base64
import csv
import datetime
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

API = "https://api.github.com"


def gh(method, path, token, body=None):
    url = API + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.load(e)
        except Exception:
            return e.code, {"message": e.read().decode(errors="ignore")}


def file_exists(repo, path, token):
    status, _ = gh("GET", f"/repos/{repo}/contents/{path}", token)
    return status == 200


def yaml_escape(s):
    s = s.replace("\\", "\\\\").replace('"', '\\"')
    return s


def make_description(body):
    first_para = body.strip().split("\n\n")[0]
    first_para = re.sub(r"\s+", " ", first_para).strip()
    m = re.match(r"^(.{40,155}?[.!?])(\s|$)", first_para)
    desc = m.group(1) if m else first_para[:155]
    return desc.strip()


def build_md(row, body, hero_url, pub_date):
    fm = [
        "---",
        f'title: "{yaml_escape(row["title"])}"',
        f'description: "{yaml_escape(make_description(body))}"',
        f'category: "{yaml_escape(row["category"])}"',
        f'pubDate: "{pub_date}"',
        'author: "Redação"',
        f'heroImage: "{hero_url}"',
        f'heroImageAlt: "{yaml_escape(row["title"])}"',
        "draft: false",
        "---",
        "",
    ]
    return "\n".join(fm) + body.strip() + "\n"


def stagger_date(index, total, days_back=30):
    start = datetime.date.today() - datetime.timedelta(days=days_back)
    offset = int(index * days_back / max(1, total))
    return (start + datetime.timedelta(days=offset)).isoformat()


def main(argv):
    blog_dir = argv[0]
    repo = argv[1]
    only = set(argv[argv.index("--only") + 1].split(",")) if "--only" in argv else None
    limit = int(argv[argv.index("--limit") + 1]) if "--limit" in argv else None
    dry = "--dry-run" in argv

    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("GITHUB_TOKEN nao definida")
        return 1

    topics = {r["id"]: r for r in csv.DictReader(open(os.path.join(blog_dir, "topics.csv"), encoding="utf-8"))}
    links = {}
    links_path = os.path.join(blog_dir, "links.csv")
    if os.path.exists(links_path):
        links = {r["id"]: r["direct_url"] for r in csv.DictReader(open(links_path, encoding="utf-8"))}

    ids = sorted(topics.keys())
    if only:
        ids = [i for i in ids if i in only]
    if limit:
        ids = ids[:limit]

    ok = skipped = failed = 0
    for idx, tid in enumerate(ids):
        row = topics[tid]
        art_path = os.path.join(blog_dir, "raw", "articles", f"{tid}.txt")
        if not os.path.exists(art_path):
            print(f"pula {tid}: sem artigo raw")
            failed += 1
            continue
        if tid not in links:
            print(f"pula {tid}: sem link de imagem em links.csv")
            failed += 1
            continue
        body = open(art_path, encoding="utf-8").read()
        pub = stagger_date(int(tid) - 1, len(topics))
        md = build_md(row, body, links[tid], pub)

        post_path = f"src/content/posts/{tid}-{row['slug']}.md"

        if dry:
            print(f"--- {tid} ({len(md)} chars) ---")
            print(md[:300])
            ok += 1
            continue

        if file_exists(repo, post_path, token):
            print(f"ja existe, pulando: {tid}")
            skipped += 1
            continue

        content_b64 = base64.b64encode(md.encode("utf-8")).decode()
        status, res = gh("PUT", f"/repos/{repo}/contents/{post_path}", token, {
            "message": f"post: {row['title']}",
            "content": content_b64,
            "branch": "main",
        })
        if status in (200, 201):
            print(f"ok {tid} -> {post_path}")
            ok += 1
        else:
            print(f"ERRO {tid}: {status} {json.dumps(res)[:200]}")
            failed += 1
        time.sleep(0.4)

    print(f"\n{ok} publicados, {skipped} ja existiam, {failed} com problema, de {len(ids)} tentados")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
