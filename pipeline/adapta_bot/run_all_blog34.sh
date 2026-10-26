#!/usr/bin/env bash
# Master autonomous pipeline for blog 3 and blog 4. Completes each blog end to
# end (articles with Kaik/Vinicius rotation, then images with cap-wait), one
# phase at a time so the DeepSeek Chromium and the Adapta browser never contend
# for memory. Idempotent: every bot skips ids whose file already exists, so
# re-running the master resumes wherever it left off.
cd "$(dirname "$0")" || exit 1
echo "==================== MASTER START $(date -u) ===================="

tally(){ for b in blog3-tecnologia blog4-financas; do
  a=$(ls ../../blogs/$b/raw/articles/*.txt 2>/dev/null | wc -l)
  i=$(ls ../../blogs/$b/raw/images/*.jpg 2>/dev/null | wc -l)
  echo "  $b: articles $a/120, images $i/120"
done; }

echo ">>> PHASE 1/4: blog3 articles"; bash run_articles_auto.sh blog3-tecnologia
echo ">>> PHASE 2/4: blog3 images";   bash run_images_auto.sh   blog3-tecnologia
echo ">>> PHASE 3/4: blog4 articles"; bash run_articles_auto.sh blog4-financas
echo ">>> PHASE 4/4: blog4 images";   bash run_images_auto.sh   blog4-financas

echo "==================== MASTER DONE $(date -u) ===================="
tally
