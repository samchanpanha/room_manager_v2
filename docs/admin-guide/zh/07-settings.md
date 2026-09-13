# 7. 设置参考（M28）

**位置：** Admin → Settings。所有变更都**审计**；财务设置
**仅向前生效**（已入账历史永不改写）。

| 分组 | 控制项 | 管理说明 |
|---|---|---|
| **Org** | 法定名称、地址、电话、邮箱、网站、税号、logo、发票页脚、PDF 模板（classic/modern） | 每份 PDF/收据的品牌。法定名称与税号保持准确。 |
| **Locale** | 货币、时区、UI 语言（en/km/zh） | ⚠️ 上线时**一次性定好货币**；有数据后不可更改。 |
| **Billing** | 发票前缀、宽限天数（默认 **3**）、催缴天数（**[3,7,14]**） | 决定编号与提醒/滞纳金启动时机。仅向前生效。 |
| **Late fee** | 模式 none/flat/percent、固定金额、月费率（bp）、上限 | 默认关闭。启用时务必设**上限** — 费用不超过欠款。 |
| **Retention** | outbox 90d、events 365d、OTP 7d、session 30d | **审计 trail 永不清除。** |
| **Features** | 各模块开关（POS、Stock、Telegram、PO 默认开） | 关闭隐藏菜单 + 门禁访问；**数据保留**。 |
| **Reports** | enabledKeys、assignments、designs | 谁看哪些报表；数据保持来源可溯。 |
| **Templates** | Telegram 文案覆盖，5 类事件，`{placeholders}` | issued / receipt / dunning / reminder / overdue 文案。 |
| **Printers** | 58/80mm、自动打印、份数、默认条码 | POS 小票/标签打印。 |
| **Telegram** | Bot 显示名、欢迎语、会员自助绑定 | 租客 bot 行为。 |
| **Menu** | 侧边栏位置（left/right） | 仅布局偏好 — 可见性来自权限。 |
| **Units / Table** | 库存单位；默认分页大小（25） | 列表密度 + 物品单位。 |
| **Alerts（M33）** | ahead 天数（3）、overdue 天数（1） | 仪表盘到期/逾期窗口。 |
| **Secrets** | 支付凭证、Telegram token | **AES-256-GCM 密封**，读取掩码；环境变量为回退。切勿在聊天中粘贴密钥。 |
| **Opening balances** | 平衡的 `opening` 总账分录 | 迁入 RentManager 时使用；必须平衡。 |

## 环境变量（服务端）

| 变量 | 用途 | 默认值（dev） |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接 | `postgresql://rentmanager:rentmanager@localhost:5432/rentmanager` |
| `SESSION_TTL_DAYS` | 会话有效期 | `30` |
| `FILE_SIGNING_SECRET` | 签名文件 URL | `.env` 中的随机 dev 值 |
| `PAYMENT_WEBHOOK_SECRET` | 网关 webhook HMAC | `dev-webhook-secret-change-me` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` / `TELEGRAM_BOT_USERNAME` | Telegram bot | `dev-*` 占位 |
| `SETTINGS_ENC_KEY` | 密封设置加密（32 字节） | 投产必须设置 |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | 对象存储 | Docker 中的 MinIO |
| `APP_BASE_URL` | 公共基地址（PDF/消息中的链接） | `http://localhost:3000` |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO 控制台 + S3 | `rentmanager` / `rentmanager-s3-secret` |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | Grafana | `admin` / `admin` |
| `COOKIE_SECURE` | 安全 Cookie | 本地 `false` → HTTPS 后 **`true`** |
| `SEED_FULL_DEMO` | 写入完整演示数据 | Docker 中为 `1` |

本地运行复制 `.env.example` → `.env`；Docker 中 compose 文件注入
生产风格的值 — 通过 shell 环境或 `docker-compose.override.yml`
覆盖密钥（切勿提交真实密钥）。

---
