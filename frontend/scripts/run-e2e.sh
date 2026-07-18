#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ]]; then
  exec npx playwright test --workers=1
fi

tests=(
  "顾问从机会到审核、跟进、试驾和视频预览的完整路径"
  "活动明细支持单任务重试、全部失败重试和抽样送审"
  "顾问画像保存后切换和刷新仍然存在，重置后恢复"
  "两个浏览器上下文工作区互不影响，刷新路由不丢失"
  "网络中断时本地演示仍能走通生成、审核、回复、预约和批量任务"
  "顾问画像保存失败时显示错误且不显示成功提示"
  "视频接口失败时页面明确显示提交失败"
  "许先生试驾预约使用实际负责顾问林悦"
  "主要操作产生真实状态变化且可见按钮具备可访问名称"
)

cleanup() {
  pkill -9 -x chromium 2>/dev/null || true
  pkill -9 -x chrome_crashpad_handler 2>/dev/null || true
  while read -r pid; do [[ -n "$pid" ]] && kill -9 "$pid" 2>/dev/null || true; done < <(pgrep -f '^python -m uvicorn app.main:app --host 127.0.0.1 --port 8012$' || true)
  while read -r pid; do [[ -n "$pid" ]] && kill -9 "$pid" 2>/dev/null || true; done < <(pgrep -f '^node ./node_modules/.bin/vite --host 127.0.0.1 --port 4176$' || true)
  rm -rf /tmp/playwright_chromiumdev_profile-* /tmp/playwright-artifacts-* 2>/dev/null || true
}

base_tmp="${TMPDIR:-/tmp}/onvo-playwright-$$"
trap 'cleanup; rm -rf "$base_tmp"' EXIT
mkdir -p "$base_tmp"

index=0
for title in "${tests[@]}"; do
  index=$((index + 1))
  home="$base_tmp/home-$index"
  temp="$base_tmp/tmp-$index"
  mkdir -p "$home" "$temp"
  echo
  echo "=== Playwright $index/${#tests[@]}: $title ==="
  HOME="$home" XDG_CONFIG_HOME="$home/.config" TMPDIR="$temp" \
    env -u CI ./node_modules/.bin/playwright test --grep "$title" --workers=1 --reporter=line
  cleanup
  sleep 8
done

echo
printf 'Playwright E2E passed: %s isolated scenario tests.\n' "${#tests[@]}"
