#!/bin/bash
# 遍历 cloudfunctions/*/ 上传所有云函数
# 用法：./uploadCloudFunction.sh [env]
set -e
ENV=${1:-""}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

# 注意：此脚本仅打印指令，实际部署需在微信开发者工具内操作
# 在 cloudfunctions/<name>/ 右键 -> 上传并部署：云端安装依赖

echo "=== 需部署的云函数 ==="
for dir in "$ROOT"/cloudfunctions/*/; do
  if [ -f "$dir/package.json" ] && [ -f "$dir/index.js" ]; then
    name=$(basename "$dir")
    echo "  $name"
  fi
done
echo
echo "=== 部署步骤 ==="
echo "1. 在微信开发者工具左侧文件树，右键 cloudfunctions/<name>/"
echo "2. 选择「上传并部署：云端安装依赖（不上传 node_modules）」"
echo "3. 等待云端部署完成（首次约 30s）"
echo
echo "=== reminderDispatcher 定时触发器配置 ==="
echo "1. 在云开发控制台 -> 云函数 -> reminderDispatcher -> 触发器管理"
echo "2. 创建触发器，触发周期：Cron 表达式 \"* * * * * *\"（每分钟）"
echo
echo "=== reminderDispatcher 环境变量 ==="
echo "在云函数配置 -> 环境变量中添加 SUBSCRIBE_TEMPLATE_ID=<你的模板 ID>"
