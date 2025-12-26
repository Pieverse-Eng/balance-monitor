# Balance Monitor

监控 Pieverse Facilitator 余额的服务，使用 OpenTelemetry 将指标发送到 Grafana Cloud。

## 功能特性

- 🔄 定时检查 facilitator.pieverse.io 的余额
- 📊 使用 OpenTelemetry 记录指标
- 📈 通过 Grafana Cloud 可视化和报警
- 💾 内存存储上一次余额状态（重启后重置）

## 部署到 Railway

### 1. 准备 Grafana Cloud

1. 登录 Grafana Cloud
2. 获取 Grafana API Key：
   - 访问 Cloud Portal
   - 进入你的 stack
   - 选择 Security > API Keys
   - 创建新的 API Key，选择 `MetricsPublisher` 角色
3. 获取 OTLP Endpoint：
   - 默认为 `https://otlp-gateway-prod-us-central-0.grafana.net:4317`
   - 或在 Cloud Portal 的 Stack Details 中查找

### 2. 部署步骤

1. 将项目推送到 GitHub

2. 在 Railway 中新建项目：
   - 选择 "Deploy from GitHub repo"
   - 选择你的仓库
   - Railway 会自动检测 Node.js 项目

3. 设置环境变量：
   在 Railway 的项目设置中添加：
   ```
   OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-central-0.grafana.net:4317
   OTEL_EXPORTER_OTLP_HEADERS={"Authorization":"Bearer 你的 Grafana API Key"}
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

### 4. 在 Grafana Cloud 配置报警

1. 创建 Dashboard：
   - 导入查询：`facilitator_balance` 查看余额
   - 导入查询：`balance_change_count` 查看变化次数
   - 导入查询：`balance_check_errors` 查看错误次数

2. 创建 Alert Rule：
   - 选择你的 dashboard
   - 设置条件，例如：`balance_change_count > 0`
   - 配置通知渠道（Email, Slack, PagerDuty 等）

## 本地运行

```bash
# 安装依赖
npm install

# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件，填入你的 Grafana Cloud 配置
nano .env

# 启动服务
npm start
```

## 环境变量

| 变量名 | 描述 | 必需 |
|--------|------|------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Grafana OTLP endpoint | ✅ |
| `OTEL_EXPORTER_OTLP_HEADERS` | 包含认证头信息的 JSON | ✅ |

### 环境变量示例

```
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-central-0.grafana.net:4317
OTEL_EXPORTER_OTLP_HEADERS={"Authorization":"Bearer glc_eyJ..."}
```

## 导出的指标

### Gauge 指标
- `facilitator_balance`: 当前余额（单位：eth）
  - labels: `network`, `address`

### Histogram 指标
- `balance_check_duration`: 余额检查耗时（单位：ms）

### Counter 指标
- `balance_change_count`: 余额变化次数
  - labels: `network`
- `balance_check_errors`: 检查错误次数
  - labels: `error`

## API 端点

监控的服务：https://facilitator.pieverse.io

返回数据示例：
```json
{
  "facilitators": {
    "bsc": {
      "address": "0x12343e649e6b2b2b77649DFAb88f103c02F3C78b",
      "balance": "0.11859444416"
    },
    "base": {
      "address": "0x12343e649e6b2b2b77649DFAb88f103c02F3C78b",
      "balance": "0.008255001578379474"
    },
    "monad": {
      "address": "0xfa6b2a1FC2151197cE3242D0Ea64327b798Dbd4a",
      "balance": "1.383368652096810146"
    }
  }
}
```