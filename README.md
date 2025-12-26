# Balance Monitor

监控 Pieverse Facilitator 余额变化并发送 Telegram 报警的服务。

## 功能特性

- 🔄 定时检查 facilitator.pieverse.io 的余额
- 🚨 余额变化时发送 Telegram 报警
- 🤖 支持 Telegram 机器人命令查询状态
- 💾 内存存储上一次余额状态（重启后重置）

## 部署到 Railway

### 1. 准备工作

1. 创建 Telegram Bot：
   - 与 @BotFather 对话创建新机器人
   - 获取 `BOT TOKEN`

2. 获取 Chat ID：
   - 与你的机器人对话
   - 发送任意消息
   - 访问 `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - 找到 `chat.id`

### 2. 部署步骤

1. 将项目推送到 GitHub

2. 在 Railway 中新建项目：
   - 选择 "Deploy from GitHub repo"
   - 选择你的仓库
   - Railway 会自动检测 Node.js 项目

3. 设置环境变量：
   在 Railway 的项目设置中添加：
   ```
   TELEGRAM_BOT_TOKEN=你的机器人token
   TELEGRAM_CHAT_ID=你的chat_id
   NODE_ENV=production
   ```

4. 部署自动开始

### 3. Railway 配置

创建 `railway.json`：
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

## 本地运行

```bash
# 安装依赖
npm install

# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件，填入你的 Telegram 配置
nano .env

# 启动服务
npm start
```

## Telegram 机器人命令

- `/start` - 启动机器人
- `/status` - 查看当前余额状态

## 环境变量

| 变量名 | 描述 | 必需 |
|--------|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram 机器人 token | ✅ |
| `TELEGRAM_CHAT_ID` | 接收报警的聊天 ID | ✅ |
| `NODE_ENV` | 运行环境 | ❌ |

## API 端点

监控的服务：https://facilitator.pieverse.io

返回数据示例：
```json
{
  "facilitators": {
    "bsc": {
      "address": "0x12343e649e6b2b2b77649DFAb88f103c02F3C78b",
      "balance": "0.11859444416"
    }
  }
}
```