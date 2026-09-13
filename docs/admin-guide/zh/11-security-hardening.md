# 11. 安全加固检查清单


## 上线前

构建已内置基线：scrypt 密码、数据库可撤销会话、
httpOnly Cookie、登录限流、TOTP 2FA（Admin+ 强制）、签名登录质询、
防篡改审计哈希链 + PII 掩码、CSP +
安全头、密封 provider 密钥、短 TTL 的 S3 签名 URL。
（见 `manual/09-security-guide.md` + `SECURITY.md`。）

投产前，管理员必须：

- [ ] 更改**所有**默认密钥：`FILE_SIGNING_SECRET`、
 `PAYMENT_WEBHOOK_SECRET`、`SETTINGS_ENC_KEY`（32+ 随机字节）、
 `TELEGRAM_WEBHOOK_SECRET`、数据库密码、Redis 密码、
 MinIO root 密码、Grafana 管理员、Nacos/Keycloak 管理员。
- [ ] 禁用或修改**所有 `*@demo.test` 账号**；创建真实管理员；
 为每个 Admin+ 注册 **2FA**。
- [ ] 设置 `COOKIE_SECURE=true` 并**仅 HTTPS** 对外（反向代理：
 Caddy/Nginx/Traefik + TLS；`APP_BASE_URL` = 公共 https 地址）。
- [ ] 内部端口（5432、6379、8848、7080、9092、9000……）仅绑
 localhost 或私网 — 切勿把 DB/Redis/Kafka 暴露到公网。
- [ ] 确认 auth + webhook **限流**；确认 Telegram/Payment
 webhook 拒绝坏签名（伪造测试）。
- [ ] 运行 **Verify audit chain**；确认日志中 PII 掩码。
- [ ] 安排**每夜备份** + 异地拷贝；上线前试恢复一次。
- [ ] 设置**保留**策略；确认审计被排除在清除之外。
- [ ] 对照组织架构复核**权限矩阵**（§4.2）；删除未用授权（最小权限）。
- [ ] 渗透自查：跨物业 IDOR、提权、webhook 伪造、URL 猜测、
 公开 `/pay` 精确金额强制。

---
