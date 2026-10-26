#!/usr/bin/env bash
# Autonomous image generation for one blog. Re-scans the (rotating) Adapta CDP
# port each round, runs the image bot (which has modal-dismiss, unique-src
# detection, per-id watchdog, and clean exit on tab crash). On a CDP connect
# wedge it unwedges (close dead tabs + reload only frozen ones) and retries. On
# no progress (daily cap or stuck) it sleeps 30m and retries, so it resumes on
# its own after the 00:01 UTC cap reset. Runs until all 120 exist.
cd "$(dirname "$0")" || exit 1
BLOG="$1"
CHAT="${2:-https://agent.adapta.one/agentic-chat/01a0dd99-4001-7146-b48b-8b33f2fcba21}"
IMG="../../blogs/$BLOG/raw/images"
LOGT(){ echo "$(date -u +%H:%M:%S) [$BLOG images] $*"; }

nmiss(){ local m=0 i; for i in $(seq -w 1 120); do [ -f "$IMG/$i.jpg" ]||m=$((m+1)); done; echo $m; }
find_port(){ powershell -NoProfile -ExecutionPolicy Bypass -File ./_findadaptaport.ps1 2>/dev/null | tr -d '[:space:]'; }

capwait=0
LOGT "start, $(nmiss)/120 missing"
for iter in $(seq 1 200); do
  m=$(nmiss); [ "$m" -eq 0 ] && { LOGT "ALL 120 DONE"; break; }
  PORT=$(find_port)
  if [ -z "$PORT" ]; then LOGT "no Adapta CDP port; wait 3m"; sleep 180; continue; fi
  before=$m
  LOGT "iter $iter: $before missing | port=$PORT"
  : > /tmp/imgrun_$BLOG.tmp 2>/dev/null || true
  BLOG_DIR="$BLOG" ADAPTA_CDP="http://127.0.0.1:$PORT" ADAPTA_CHAT_URL="$CHAT" node image_bot.js 2>&1 | tee -a "image_auto_$BLOG.log"
  after=$(nmiss)
  LOGT "iter $iter: $before -> $after missing"
  if [ "$after" -lt "$before" ]; then capwait=0; sleep 5; continue; fi
  # No progress: a hung tab may have blocked the CDP connect. Unwedge and RETRY
  # the bot once — only if that retry also makes nothing do we treat it as the cap.
  LOGT "no new images; running unwedge on port $PORT then retrying"
  CDPPORT=$PORT node _unwedge.js 2>&1 | tail -2
  sleep 3
  PORT=$(find_port); [ -z "$PORT" ] && PORT=51956
  BLOG_DIR="$BLOG" ADAPTA_CDP="http://127.0.0.1:$PORT" ADAPTA_CHAT_URL="$CHAT" node image_bot.js 2>&1 | tee -a "image_auto_$BLOG.log"
  after2=$(nmiss)
  if [ "$after2" -lt "$before" ]; then capwait=0; sleep 5; continue; fi
  capwait=$((capwait+1))
  # After a couple of no-progress rounds it's almost certainly the daily cap;
  # sleep 30m and retry (this naturally resumes after the 00:01 UTC reset).
  LOGT "still no progress (round $capwait) — likely daily cap; sleeping 30m then retrying"
  sleep 1800
done
LOGT "end: $(nmiss)/120 missing"
