#!/usr/bin/env bash
# V3 一期冒烟测试：不需登录，确认接口路由都活着
#
# 用法：
#   BASE_URL=https://你的域名 ./scripts/smoke-test-v3.sh

set -e
BASE_URL="${BASE_URL:-http://localhost:3000}"

G='\033[0;32m'
R='\033[0;31m'
Y='\033[0;33m'
N='\033[0m'

check() {
  local desc="$1"
  local expected_status="$2"
  local url="$3"
  local actual=$(curl -sS -o /dev/null -w "%{http_code}" "$url")
  if [[ "$actual" == "$expected_status" ]]; then
    echo -e "${G}✓${N} $desc → $actual"
  else
    echo -e "${R}✗${N} $desc → expected $expected_status got $actual ($url)"
  fi
}

echo "Base URL: $BASE_URL"
echo "===================="

# V2 接口（确认零回归）
check "V2 health"                       200 "$BASE_URL/api/health"
check "V2 knowledge list"               200 "$BASE_URL/api/v2/knowledge?language=zh&page=1"
check "V1 knowledge list（老路由保留）"   200 "$BASE_URL/api/knowledge?language=zh&page=1"

# V3 接口（验证路由注册）
check "V3 family/me（未授权 401）"        401 "$BASE_URL/api/v3/family/groups/me"
check "V3 user/v3/heartbeat（未授权 401）" 401 "$BASE_URL/api/user/v3/heartbeat"
check "V3 family/broadcasts（未授权 401）" 401 "$BASE_URL/api/v3/family/broadcasts?limit=10"

# Universal Link 文件（无需鉴权）
check "AASA Apple Universal Link 文件"   200 "$BASE_URL/.well-known/apple-app-site-association"
check "AssetLinks Android 占位"           200 "$BASE_URL/.well-known/assetlinks.json"

echo "===================="
echo "如果上面全部 ✓ 表明：DB migration 成功、V3 路由注册完整、V2 零回归"
