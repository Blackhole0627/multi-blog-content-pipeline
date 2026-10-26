# -*- coding: utf-8 -*-
"""Upload the raw bot images of one blog to imgbb and record every link.

Usage (PowerShell):
    $env:IMGBB_API_KEY = "sua-chave"
    python pipeline\\upload_raw_images.py blogs\\blog1-tecnologia [--limit 3]

Reads raw/images/<id>.jpg, writes <blog>/links.csv with one row per id:
id, direct_url, viewer_url. Safe to stop and run again, ids that
already have a link are skipped. The key is read from the environment and is
never printed or written to disk.
"""
import base64
import csv
import json
import os
import sys
import time
import urllib.parse
import urllib.request

API = "https://api.imgbb.com/1/upload"
FIELDS = ["id", "direct_url", "viewer_url"]


def upload(path, key, name):
    data = base64.b64encode(open(path, "rb").read()).decode()
    body = urllib.parse.urlencode({"key": key, "image": data, "name": name}).encode()
    with urllib.request.urlopen(urllib.request.Request(API, data=body), timeout=120) as r:
        res = json.load(r)
    if not res.get("success"):
        raise RuntimeError(str(res)[:200])
    d = res["data"]
    return d["url"], d.get("url_viewer", "")


def main(argv):
    blog = argv[0] if argv and not argv[0].startswith("--") else "blogs/blog1-tecnologia"
    limit = int(argv[argv.index("--limit") + 1]) if "--limit" in argv else None
    key = os.environ.get("IMGBB_API_KEY")
    if not key:
        print("IMGBB_API_KEY nao definida")
        return 1
    img_dir = os.path.join(blog, "raw", "images")
    out = os.path.join(blog, "links.csv")
    done = {}
    if os.path.exists(out):
        for r in csv.DictReader(open(out, encoding="utf-8")):
            done[r["id"]] = r
    ids = sorted(f[:3] for f in os.listdir(img_dir) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
    todo = [i for i in ids if i not in done]
    if limit:
        todo = todo[:limit]
    new_file = not os.path.exists(out)
    ok = failed = 0
    with open(out, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if new_file:
            w.writeheader()
        for tid in todo:
            path = next(os.path.join(img_dir, tid + e) for e in (".jpg", ".jpeg", ".png", ".webp")
                        if os.path.exists(os.path.join(img_dir, tid + e)))
            for attempt in range(3):
                try:
                    direct, viewer = upload(path, key, tid)
                    w.writerow({"id": tid, "direct_url": direct, "viewer_url": viewer})
                    f.flush()
                    print(f"ok  {tid}  {direct}", flush=True)
                    ok += 1
                    break
                except Exception as e:
                    print(f"erro {tid} tentativa {attempt + 1}: {str(e)[:120]}", flush=True)
                    time.sleep(5 * (attempt + 1))
            else:
                failed += 1
            time.sleep(1)
    total = len(done) + ok
    print(f"\n{ok} enviadas agora, {failed} falharam, {total} de {len(ids)} com link em {out}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
