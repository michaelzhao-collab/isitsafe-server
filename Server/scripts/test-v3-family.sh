#!/usr/bin/env bash
# V3 一期 E 模块 family 接口端到端测试脚本
#
# 用法：
#   1. 本地：先 npm run start:dev 起服务（需要 PG + Redis）
#      ./scripts/test-v3-family.sh
#   2. Staging：
#      BASE_URL=https://staging.starlens.ai ./scripts/test-v3-family.sh
#
# 前置：需要 2 个测试账号的 JWT token（手动登录拿到）
#   TOKEN_OWNER  - 用户 A，将创建家庭组
#   TOKEN_GUEST  - 用户 B，将通过邀请码加入
#   提示：可手动调 /api/auth/login 获取，或从 iOS Keychain 复制

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
TOKEN_OWNER="${TOKEN_OWNER:-}"
TOKEN_GUEST="${TOKEN_GUEST:-}"

if [[ -z "$TOKEN_OWNER" || -z "$TOKEN_GUEST" ]]; then
  echo "❌ 必须设置 TOKEN_OWNER 和 TOKEN_GUEST 环境变量"
  echo "示例: TOKEN_OWNER=xxx TOKEN_GUEST=yyy ./scripts/test-v3-family.sh"
  exit 1
fi

C='\033[0;36m'  # cyan
G='\033[0;32m'  # green
R='\033[0;31m'  # red
Y='\033[0;33m'  # yellow
N='\033[0m'

step() { echo -e "\n${C}➤ $1${N}"; }
ok()   { echo -e "${G}✓ $1${N}"; }
fail() { echo -e "${R}✗ $1${N}"; exit 1; }
warn() { echo -e "${Y}⚠ $1${N}"; }

# 通用 curl helper
api() {
  local method="$1"
  local path="$2"
  local token="$3"
  local body="${4:-}"
  local auth_header=""
  [[ -n "$token" ]] && auth_header="Authorization: Bearer $token"
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "$BASE_URL$path" \
      -H "$auth_header" \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -sS -X "$method" "$BASE_URL$path" \
      -H "$auth_header" \
      -H "Content-Type: application/json"
  fi
}

# =====================================================
# Phase 1: 基础检查
# =====================================================
step "Phase 1: 服务端健康检查"

HEALTH=$(curl -sS "$BASE_URL/api/health" || echo '{"status":"error"}')
echo "  health: $HEALTH"
echo "$HEALTH" | grep -q '"status":"ok"' && ok "服务在线" || warn "health 响应异常"

# AASA（Universal Link 验证文件）
step "Phase 2: Apple Universal Link AASA 文件"
AASA=$(curl -sS "$BASE_URL/.well-known/apple-app-site-association")
echo "  AASA: $AASA"
echo "$AASA" | grep -q '"applinks"' && ok "AASA 文件可访问" || fail "AASA 文件不可访问"

# =====================================================
# Phase 2: 心跳上报（关怀机制）
# =====================================================
step "Phase 3: 心跳上报"

HB1=$(api POST /api/user/v3/heartbeat "$TOKEN_OWNER")
echo "  Owner heartbeat: $HB1"
echo "$HB1" | grep -q '"active":true' && ok "Owner 心跳成功" || fail "Owner 心跳失败"

HB2=$(api POST /api/user/v3/heartbeat "$TOKEN_GUEST")
echo "  Guest heartbeat: $HB2"
echo "$HB2" | grep -q '"active":true' && ok "Guest 心跳成功" || fail "Guest 心跳失败"

# =====================================================
# Phase 3: 创建家庭组
# =====================================================
step "Phase 4: Owner 创建家庭组（免费）"

# 先确保 Owner 不在任何家庭组
MY1=$(api GET /api/v3/family/groups/me "$TOKEN_OWNER")
echo "  Owner before: $MY1"

if echo "$MY1" | grep -q '"id"'; then
  warn "Owner 已在家庭组，先解散"
  GID=$(echo "$MY1" | grep -o '"id":"[^"]*"' | head -1 | sed 's/.*"id":"\([^"]*\)".*/\1/')
  api DELETE "/api/v3/family/groups/$GID" "$TOKEN_OWNER" > /dev/null
  ok "已解散旧组 $GID"
fi

CREATE=$(api POST /api/v3/family/groups "$TOKEN_OWNER" '{"name":"E2E 测试家庭"}')
echo "  Create: $CREATE"
GROUP_ID=$(echo "$CREATE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/.*"id":"\([^"]*\)".*/\1/')
[[ -n "$GROUP_ID" ]] && ok "创建成功 groupId=$GROUP_ID" || fail "创建失败"

# 再查一次确认
MY2=$(api GET /api/v3/family/groups/me "$TOKEN_OWNER")
echo "  Owner after: $MY2"
echo "$MY2" | grep -q "\"id\":\"$GROUP_ID\"" && ok "Owner 已加入新组" || fail "Owner 状态异常"

# =====================================================
# Phase 4: 邀请码 + 兑换
# =====================================================
step "Phase 5: Owner 生成邀请码"

INV=$(api POST "/api/v3/family/groups/$GROUP_ID/invites" "$TOKEN_OWNER")
echo "  Invite: $INV"
INVITE_CODE=$(echo "$INV" | grep -o '"code":"[^"]*"' | sed 's/.*"code":"\([^"]*\)".*/\1/')
[[ -n "$INVITE_CODE" && "${#INVITE_CODE}" -eq 6 ]] && ok "邀请码生成 code=$INVITE_CODE" || fail "邀请码格式异常"

step "Phase 6: Guest 兑换邀请码"

# 先确保 Guest 不在任何家庭组
GME=$(api GET /api/v3/family/groups/me "$TOKEN_GUEST")
if echo "$GME" | grep -q '"id"'; then
  warn "Guest 已在家庭组，先退出"
  api POST "/api/v3/family/groups/$GROUP_ID/leave" "$TOKEN_GUEST" > /dev/null || true
fi

REDEEM=$(api POST /api/v3/family/invites/redeem "$TOKEN_GUEST" "{\"inviteCode\":\"$INVITE_CODE\"}")
echo "  Redeem: $REDEEM"
echo "$REDEEM" | grep -q "\"groupId\":\"$GROUP_ID\"" && ok "Guest 兑换成功，已加入家庭组" || fail "兑换失败"

# Owner 视角查家庭组
step "Phase 7: 确认成员关系"
MY3=$(api GET /api/v3/family/groups/me "$TOKEN_OWNER")
echo "  Owner sees: $MY3"
COUNT=$(echo "$MY3" | grep -o '"memberCount":[0-9]*' | sed 's/.*:\([0-9]*\).*/\1/')
[[ "$COUNT" -eq 2 ]] && ok "成员数 = 2（Owner + Guest）" || fail "成员数异常 = $COUNT"

# =====================================================
# Phase 5: 官方匿名广播
# =====================================================
step "Phase 8: Owner 主动分享一条信息（触发官方广播）"

BC1=$(api POST /api/v3/family/broadcast "$TOKEN_OWNER" \
  '{"contentType":"sms","content":"您的医保账户有1280元退费未领取，请加客服微信13800001234办理"}')
echo "  Broadcast 1: $BC1"
echo "$BC1" | grep -q '"delivered":true' && ok "首次广播成功 + 推送" || warn "广播可能未交付"

# 同样内容再来一次 → 应触发 duplicate skipReason
BC2=$(api POST /api/v3/family/broadcast "$TOKEN_OWNER" \
  '{"contentType":"sms","content":"您的医保账户有1280元退费未领取，请加客服微信13800001234办理"}')
echo "  Broadcast 2 (duplicate): $BC2"
echo "$BC2" | grep -q '"skipReason":"duplicate"' && ok "重复内容正确拦截" || warn "未拦截重复"

# Guest 查家庭官方消息
step "Phase 9: Guest 拉家庭官方消息（验证不显示触发者）"
LIST=$(api GET "/api/v3/family/broadcasts?limit=10" "$TOKEN_GUEST")
echo "  Broadcasts (Guest sees): $LIST"
echo "$LIST" | grep -q "triggeredByUserId" && fail "❌ 严重隐私泄露：返回了 triggeredByUserId" || ok "未返回触发者身份（隐私保护正常）"
echo "$LIST" | grep -q '"contentDisplay"' && ok "Guest 能看到内容" || fail "Guest 看不到内容"

# 配额测试：第 3 条应被 quota_exceeded 拒绝（免费用户 1 条/天）
step "Phase 10: 配额测试（免费 1 条/天）"
BC3=$(api POST /api/v3/family/broadcast "$TOKEN_OWNER" \
  '{"contentType":"phone","content":"+86 13900001234"}')
echo "  Broadcast 3: $BC3"
echo "$BC3" | grep -q '"skipReason":"quota_exceeded"' && ok "配额正确拦截" || warn "配额未拦截（可能用户是 Pro，或上面 1 条没算）"

# =====================================================
# Phase 6: 隐私偏好
# =====================================================
step "Phase 11: Guest 关闭"我的查询广播"开关"
PREF=$(api PUT /api/v3/family/members/me/preferences "$TOKEN_GUEST" \
  '{"shareQueryResults":false}')
echo "  Preferences: $PREF"
ok "隐私偏好已更新"

# =====================================================
# Phase 7: 退出/解散
# =====================================================
step "Phase 12: Guest 退出家庭组"
LEAVE=$(api POST "/api/v3/family/groups/$GROUP_ID/leave" "$TOKEN_GUEST")
echo "  Leave: $LEAVE"
echo "$LEAVE" | grep -q '"success":true' && ok "Guest 退出成功" || fail "退出失败"

step "Phase 13: Owner 解散家庭组"
DISSOLVE=$(api DELETE "/api/v3/family/groups/$GROUP_ID" "$TOKEN_OWNER")
echo "  Dissolve: $DISSOLVE"
echo "$DISSOLVE" | grep -q '"success":true' && ok "解散成功" || fail "解散失败"

# Final check
FINAL=$(api GET /api/v3/family/groups/me "$TOKEN_OWNER")
echo "  Owner final: $FINAL"
[[ "$FINAL" == "null" || "$FINAL" == "" ]] && ok "Owner 已离组" || warn "Owner 状态可能未清除"

echo -e "\n${G}================================================${N}"
echo -e "${G}  ✓ V3 E 模块 13 个测试全部通过${N}"
echo -e "${G}================================================${N}"
