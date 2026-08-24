#!/bin/bash
# next dev 는 자식 next-server 가 시그널로 죽으면 아무 메시지도 없이 코드 0 으로 종료한다
# (node_modules/next/dist/cli/next-dev.js 의 child.on('exit') 가 signal 일 때 early return).
# 그래서 로그가 마지막 요청 뒤에서 그냥 끊기고 "서버가 저절로 다운된" 것처럼 보인다.
# 이 래퍼는 감독 프로세스가 삼키는 종료 원인과 종료 직전 메모리를 남긴다.
set -uo pipefail

LOG_DIR="${DEV_DOCTOR_LOG_DIR:-.next/dev-doctor}"
mkdir -p "$LOG_DIR"
EVENTS="$LOG_DIR/events.log"
MEMORY="$LOG_DIR/memory.log"
: > "$MEMORY"

say() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*" | tee -a "$EVENTS"; }

# 프로세스 트리는 npm → next dev(감독) → next-server(실제 서버) 3단이다.
# 메모리를 먹는 쪽은 손자인 next-server 이므로 감독이 아니라 손자를 추적해야 한다.
find_server() {
  local supervisor=$1
  pgrep -P "$supervisor" 2>/dev/null | head -1
}

sample_memory() {
  local supervisor=$1 server rss
  while kill -0 "$supervisor" 2>/dev/null; do
    server=$(find_server "$supervisor")
    if [ -n "$server" ]; then
      rss=$(ps -o rss= -p "$server" 2>/dev/null | tr -d ' ')
      [ -n "$rss" ] && printf '%s next-server=%s rss_mb=%s\n' \
        "$(date '+%H:%M:%S')" "$server" "$((rss / 1024))" >> "$MEMORY"
    fi
    sleep 5
  done
}

say "=== dev-doctor 시작 (로그: $LOG_DIR) ==="
say "node $(node -v) / next $(node -p "require('next/package.json').version" 2>/dev/null)"
say "heap 한계 $(node -p "(require('v8').getHeapStatistics().heap_size_limit/1048576).toFixed(0)")MB"

npm run dev &
NPM=$!

# npm 아래의 감독(next dev)과 그 아래의 next-server 를 모두 붙잡아 둔다.
# 부모가 사라진 뒤에도 어느 pid 가 죽었는지 대조하려면 미리 기록해야 한다.
SUPERVISOR=""
SERVER=""
for _ in $(seq 1 120); do
  [ -z "$SUPERVISOR" ] && SUPERVISOR=$(pgrep -P "$NPM" 2>/dev/null | head -1)
  if [ -n "$SUPERVISOR" ]; then
    SERVER=$(find_server "$SUPERVISOR")
    [ -n "$SERVER" ] && break
  fi
  sleep 0.5
done
say "npm=$NPM 감독(next dev)=${SUPERVISOR:-미확인} next-server=${SERVER:-미확인}"

[ -n "$SUPERVISOR" ] && { sample_memory "$SUPERVISOR" & SAMPLER=$!; } || SAMPLER=""

wait "$NPM"
STATUS=$?
[ -n "$SAMPLER" ] && { kill "$SAMPLER" 2>/dev/null; wait "$SAMPLER" 2>/dev/null; }

say "---------- 서버가 종료됨 ----------"
if [ "$STATUS" -gt 128 ]; then
  SIG=$((STATUS - 128))
  say "npm 종료: 시그널 $SIG ($(kill -l "$SIG" 2>/dev/null))"
else
  say "npm 종료: 코드 $STATUS"
fi

# 감독이 조용히 코드 0 으로 죽었다면 실제 사인은 거의 항상 next-server 쪽이다.
if [ -n "$SERVER" ] && ! kill -0 "$SERVER" 2>/dev/null; then
  say "next-server($SERVER) 가 먼저 사라졌다면 감독이 원인을 삼킨 경우다"
  say "  → 원인 후보: 메모리 부족(jetsam SIGKILL) / 네이티브 크래시 / 외부 kill"
fi

say "종료 직전 메모리 추이:"
tail -5 "$MEMORY" 2>/dev/null | sed 's/^/  /' | tee -a "$EVENTS"
PEAK=$(awk -F'rss_mb=' '{print $2}' "$MEMORY" 2>/dev/null | sort -rn | head -1)
say "  최고 RSS: ${PEAK:-미확인}MB"

# jetsam 강제종료만 남긴다. runningboardd 의 우선순위/coalition 잡음은 버린다.
say "커널의 강제종료 기록(있으면 메모리 부족이 사인):"
/usr/bin/log show --last 3m --predicate 'eventMessage CONTAINS "jetsam"' --style compact 2>/dev/null \
  | grep -iE "kill|terminat|hiwat|memorystatus_do" \
  | grep -viE "Ignoring jetsam update|not RunningBoard|CONVERT_MEMLIMIT|Set jetsam priority|coalition roles|terminateprocess" \
  | tail -10 | sed 's/^/  /' | tee -a "$EVENTS"

# node 자체가 abort 한 경우(힙 OOM, 네이티브 패닉)는 크래시 리포트가 남는다.
RECENT_IPS=$(find ~/Library/Logs/DiagnosticReports -name '*.ips' -mmin -3 2>/dev/null | head -5)
say "최근 3분 내 크래시 리포트: ${RECENT_IPS:-없음}"

say "=== 전체 기록: $EVENTS / $MEMORY ==="
