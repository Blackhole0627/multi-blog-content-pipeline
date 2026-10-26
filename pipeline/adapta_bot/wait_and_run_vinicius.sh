#!/usr/bin/env bash
# Wait until Vinicius's DeepSeek profile is free (no chrome holding it), then run
# the blog2 article bot on it for all pending ids. Gives up after ~40 min.
cd "$(dirname "$0")" || exit 1

vin_chrome_count() {
  powershell -NoProfile -ExecutionPolicy Bypass -File "./_vincount.ps1" 2>/dev/null | tr -d '[:space:]'
}

echo "$(date -u +%H:%M:%S) waiting for Vinicius DeepSeek profile to free up (currently $(vin_chrome_count) chrome procs)..."
for i in $(seq 1 240); do   # 240 * 10s = 40 min
  c=$(vin_chrome_count)
  if [ "$c" = "0" ]; then
    sleep 3   # small settle so the OS releases the profile lock fully
    echo "$(date -u +%H:%M:%S) profile FREE — launching article bot on Vinicius"
    BLOG_DIR="blog2-tecnologia" \
    DEEPSEEK_PROFILE="C:\\Users\\Administrator\\Documents\\workplace-bot\\worker\\browser_profile_deepseek" \
    node article_bot.js
    echo "$(date -u +%H:%M:%S) article bot exited"
    exit 0
  fi
  sleep 10
done
echo "$(date -u +%H:%M:%S) gave up after 40 min — Vinicius profile still busy ($(vin_chrome_count) chrome)"
exit 2
