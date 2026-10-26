#!/usr/bin/env bash
# Resilient runner for the blog2 image bot. Each iteration clears any dead/orphan
# tabs, then runs the bot (which skips already-saved ids). If the Adapta tab
# crashes, the bot exits cleanly and we relaunch on the respawned tab. Stops when
# everything is done, or after several iterations with zero new images (chat
# genuinely stuck -> needs a fresh chat URL).
cd "$(dirname "$0")" || exit 1
export BLOG_DIR="blog2-tecnologia"
export ADAPTA_CDP="http://127.0.0.1:56494"
export ADAPTA_CHAT_URL="https://agent.adapta.one/agentic-chat/01a0dd99-4001-7146-b48b-8b33f2fcba21"
IMG_DIR="../../blogs/blog2-tecnologia/raw/images"

count_missing() { local m=0 i; for i in $(seq -w 1 120); do [ -f "$IMG_DIR/$i.jpg" ] || m=$((m+1)); done; echo "$m"; }

stuck=0
for iter in $(seq 1 40); do
  before=$(count_missing)
  echo "$(date -u +%H:%M:%S) === wrapper iter $iter: $before missing ==="
  [ "$before" -eq 0 ] && { echo "ALL 120 IMAGES DONE"; break; }
  node _closeblank.js >/dev/null 2>&1 || true
  node image_bot.js
  after=$(count_missing)
  echo "$(date -u +%H:%M:%S) iter $iter done: $before -> $after missing"
  if [ "$after" -ge "$before" ]; then
    stuck=$((stuck+1))
    echo "no progress ($stuck in a row)"
    [ "$stuck" -ge 3 ] && { echo "STALLED: 3 iters with no new images — chat likely needs a fresh URL"; break; }
  else
    stuck=0
  fi
  sleep 4
done
echo "$(date -u +%H:%M:%S) wrapper finished: $(count_missing) missing"
