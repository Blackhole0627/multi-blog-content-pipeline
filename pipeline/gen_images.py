"""Generate one cover image per topic with the free pollinations.ai endpoint.

Usage: python pipeline/gen_images.py blogs/blog1-tecnologia [--only 001,002] [--force]
Saves <blog>/images/<id>.jpg at 1280x720 with the bottom watermark strip cropped off.
Skips ids that already have a file unless --force is given.
"""
import csv
import hashlib
import io
import os
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image

ENDPOINT = "https://image.pollinations.ai/prompt/"
GEN_W, GEN_H = 1280, 800      # generate taller, then crop the watermark strip
CROP_BOTTOM = 64
OUT_W, OUT_H = 1280, 720
PREFIX = "Realistic editorial photograph, natural colors, sharp focus, wide shot, no close-up hands. "
SUFFIX = (". No text, no letters, no readable words, no numbers, no logo, no watermark, "
          "no visible screen content, no close-up hands or fingers, blurred or empty screens, "
          "objects and environments only, no legible signage.")


def fetch(prompt, seed):
    url = (ENDPOINT + urllib.parse.quote(PREFIX + prompt + SUFFIX)
           + f"?width={GEN_W}&height={GEN_H}&nologo=true&private=true&enhance=false&seed={seed}&model=flux")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=240).read()


def process(data):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = im.size
    im = im.crop((0, 0, w, h - int(CROP_BOTTOM * h / GEN_H)))
    im = im.resize((OUT_W, OUT_H), Image.LANCZOS)
    return im


def main(argv):
    blog_dir = argv[0] if argv and not argv[0].startswith("--") else "blogs/blog1-tecnologia"
    only = None
    force = "--force" in argv
    if "--only" in argv:
        only = set(argv[argv.index("--only") + 1].split(","))
    img_dir = os.path.join(blog_dir, "images")
    os.makedirs(img_dir, exist_ok=True)
    rows = list(csv.DictReader(open(os.path.join(blog_dir, "topics.csv"), encoding="utf-8")))
    done = skipped = failed = 0
    for r in rows:
        aid = r["id"]
        if only and aid not in only:
            continue
        out = os.path.join(img_dir, aid + ".jpg")
        if os.path.exists(out) and not force:
            skipped += 1
            continue
        seed = int(hashlib.md5(r["slug"].encode()).hexdigest()[:6], 16)
        ok = False
        for attempt in range(3):
            try:
                t = time.time()
                data = fetch(r["image_prompt"], seed + attempt)
                if len(data) < 5000:
                    raise RuntimeError("resposta muito pequena")
                process(data).save(out, "JPEG", quality=88, optimize=True)
                print(f"ok  {aid}  {round(time.time() - t)}s", flush=True)
                ok = True
                break
            except Exception as e:
                print(f"erro {aid} tentativa {attempt + 1}: {str(e)[:100]}", flush=True)
                time.sleep(10 * (attempt + 1))
        if ok:
            done += 1
        else:
            failed += 1
        time.sleep(3)
    print(f"\n{done} geradas, {skipped} ja existiam, {failed} falharam")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
