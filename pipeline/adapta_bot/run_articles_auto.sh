#!/usr/bin/env bash
# Autonomous article generation for one blog. Processes pending ids in small
# batches, rotating between Kaik and Vinicius DeepSeek profiles: while a profile
# is productive it keeps using it; when a batch makes little progress (throttle
# signature) it switches to the other free profile; if both are throttled/busy
# it sleeps and retries. Never gives up until all 120 are done.
cd "$(dirname "$0")" || exit 1
BLOG="$1"
KAIK='C:\Users\Administrator\Documents\workplace-bot2\worker\browser_profile_deepseek'
VIN='C:\Users\Administrator\Documents\workplace-bot\worker\browser_profile_deepseek'
ART="../../blogs/$BLOG/raw/articles"
BATCH=10

nmiss(){ local m=0 i; for i in $(seq -w 1 120); do [ -f "$ART/$i.txt" ]||m=$((m+1)); done; echo $m; }
next_ids(){ local o="" i c=0; for i in $(seq -w 1 120); do [ -f "$ART/$i.txt" ]||{ o="$o $i"; c=$((c+1)); [ $c -ge $BATCH ]&&break; }; done; echo $o; }
kaik_free(){ [ "$(powershell -NoProfile -ExecutionPolicy Bypass -File ./_kaikcount.ps1 2>/dev/null|tr -d '[:space:]')" = "0" ]; }
vin_free(){ [ "$(powershell -NoProfile -ExecutionPolicy Bypass -File ./_vincount.ps1 2>/dev/null|tr -d '[:space:]')" = "0" ]; }

cur="kaik"; lowstreak=0
echo "$(date -u +%H:%M:%S) [$BLOG articles] start, $(nmiss)/120 missing"
for iter in $(seq 1 120); do
  m=$(nmiss); [ "$m" -eq 0 ] && { echo "$(date -u +%H:%M:%S) [$BLOG articles] ALL 120 DONE"; break; }
  # choose a free profile, preferring $cur
  choose=""
  if [ "$cur" = "kaik" ]; then
    if kaik_free; then choose="kaik"; elif vin_free; then choose="vin"; fi
  else
    if vin_free; then choose="vin"; elif kaik_free; then choose="kaik"; fi
  fi
  if [ -z "$choose" ]; then echo "$(date -u +%H:%M:%S) [$BLOG articles] both DS profiles busy; wait 5m"; sleep 300; continue; fi
  cur="$choose"; [ "$cur" = "vin" ] && PROF="$VIN" || PROF="$KAIK"
  ids=$(next_ids); before=$m
  echo "$(date -u +%H:%M:%S) [$BLOG articles] iter $iter: $before missing | profile=$cur | batch=($ids)"
  BLOG_DIR="$BLOG" DEEPSEEK_PROFILE="$PROF" node article_bot.js $ids
  after=$(nmiss); made=$((before-after))
  echo "$(date -u +%H:%M:%S) [$BLOG articles] iter $iter made=$made/$BATCH ($before->$after) on $cur"
  # Throttle signature: a healthy batch does ~all of BATCH; fewer than 60% means
  # this profile is rate-limited. Switch to the OTHER profile if it's free; if it
  # isn't (busy with the worker, or also throttled), sleep so the throttle resets.
  if [ "$made" -lt $(( BATCH * 6 / 10 )) ]; then
    other=$([ "$cur" = "kaik" ] && echo vin || echo kaik)
    if { [ "$other" = "vin" ] && vin_free; } || { [ "$other" = "kaik" ] && kaik_free; }; then
      echo "  throttled on $cur -> switching to $other (free)"; cur="$other"; lowstreak=0
    else
      lowstreak=$((lowstreak+1))
      echo "$(date -u +%H:%M:%S)   throttled on $cur; other ($other) busy/unavailable -> sleep 15m for reset (streak $lowstreak)"
      sleep 900
    fi
  else lowstreak=0; fi
  sleep 4
done
echo "$(date -u +%H:%M:%S) [$BLOG articles] end: $(nmiss)/120 missing"
