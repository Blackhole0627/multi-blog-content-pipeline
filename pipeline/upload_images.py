"""Upload article images to imgbb and write the link back into each article's frontmatter.

Usage: set IMGBB_API_KEY, then  python pipeline/upload_images.py blogs/blog1-tecnologia
Expects images named <id>.jpg or <id>.png inside <blog>/images/. Skips articles that already have an image link.
"""
import base64
import json
import os
import re
import sys
import urllib.parse
import urllib.request

API = "https://api.imgbb.com/1/upload"


def upload(path, key, name):
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    body = urllib.parse.urlencode({"key": key, "image": data, "name": name}).encode()
    req = urllib.request.Request(API, data=body)
    with urllib.request.urlopen(req, timeout=120) as r:
        res = json.load(r)
    if not res.get("success"):
        raise RuntimeError(res)
    return res["data"]["url"]


def main(blog_dir):
    key = os.environ.get("IMGBB_API_KEY")
    if not key:
        print("IMGBB_API_KEY nao definida")
        return 1
    art_dir = os.path.join(blog_dir, "articles")
    img_dir = os.path.join(blog_dir, "images")
    done = skipped = missing = 0
    for name in sorted(os.listdir(art_dir)):
        if not name.endswith(".md"):
            continue
        aid = name[:3]
        path = os.path.join(art_dir, name)
        text = open(path, encoding="utf-8").read()
        m = re.search(r'^image: "(.*?)"$', text, re.M)
        if m and m.group(1):
            skipped += 1
            continue
        img = next((os.path.join(img_dir, aid + ext) for ext in (".jpg", ".jpeg", ".png", ".webp")
                    if os.path.exists(os.path.join(img_dir, aid + ext))), None)
        if not img:
            missing += 1
            print(f"sem imagem: {name}")
            continue
        url = upload(img, key, name[:-3])
        text = re.sub(r'^image: ".*?"$', f'image: "{url}"', text, count=1, flags=re.M)
        open(path, "w", encoding="utf-8").write(text)
        done += 1
        print(f"ok {aid} {url}")
    print(f"\n{done} enviadas, {skipped} ja tinham link, {missing} sem arquivo de imagem")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "blogs/blog1-tecnologia"))
