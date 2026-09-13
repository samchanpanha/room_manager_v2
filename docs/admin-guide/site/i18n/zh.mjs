// Admin-guide site i18n — Chinese. Mirrors en.mjs 1:1
// (same walk ids, same step counts, same diagram keys).

export const meta = {
  code: "zh",
  native: "中文",
  htmlLang: "zh-CN"
};

export const GROUP_NAMES = [
  "开始",
  "权限与人员",
  "配置",
  "运行系统",
  "上线"
];

export const PART_LABELS = {
  "01-what-rentmanager-is": "什么是 RentManager",
  "02-architecture": "架构与服务",
  "03-first-login": "首次登录与账号",
  "04-rbdc": "角色、权限与 RBDC",
  "05-user-management": "用户管理 SOP",
  "06-organisation-setup": "组织搭建",
  "07-settings": "设置参考（M28）",
  "08-module-operations": "各模块管理操作",
  "09-scheduled-jobs": "定时任务",
  "10-backup-restore": "备份与恢复",
  "11-security-hardening": "安全加固",
  "12-monitoring": "监控与日志",
  "13-updating": "系统更新",
  "14-troubleshooting": "故障排除",
  "15-go-live": "上线检查清单"
};

export const UI = {
  title: "RentManager — 管理员指南",
  brandSub: "管理员指南",
  side: {
    home: "🏠 首页",
    walks: "🧭 管理员流程",
    lang: "语言",
    foot: "已对照应用源码核对 · {n} 个部分"
  },
  home: {
    heroTitle: "管理员指南",
    heroSub:
      "安装、配置、加固并维护 RentManager — 含示意图与可点击的管理员流程。日常工作人员请改用 /guide 用户指南。",
    btnWalks: "🧭 开始管理员流程",
    btnQuick: "⚡ 首次登录",
    featStaffTitle: "用户与角色",
    featStaffText:
      "入职与离职员工、按最小权限建角色，并分配物业，让 RBDC 真正限制可见范围。",
    featStaffLink: "打开用户管理 SOP →",
    featAdminTitle: "上线前加固",
    featAdminText:
      "轮换所有默认密钥、启用 2FA、安排夜间备份，并在真实资金进入系统前锁住内部端口。",
    featAdminLink: "打开加固检查清单 →",
    sections: "{n} 个小节"
  },
  part: {
    notFound: "未找到该部分。",
    onThisPage: "本页目录",
    crumb: "管理员指南"
  },
  walks: {
    crumb: "管理员流程",
    title: "🧭 管理员流程",
    prev: "← 上一步",
    restart: "↺ 重新开始",
    next: "下一步 →",
    finish: "完成 ✓",
    done: "✅ 流程完成 — 您可以独立操作了。从列表中选择下一个流程。",
    shotCap: "🖼️ 示意图预览"
  }
};

export const WALKS = [
  {
    id: "first-login",
    title: "🔐 以超级管理员首次登录",
    role: "超级管理员",
    time: "约 10 分钟",
    intro: "在全新安装上登录、启用 2FA，并确认审计轨迹正在写入。",
    steps: [
      { t: "打开登录页", d: "访问 **http://localhost:3000/login**（或您的公开 `APP_BASE_URL`）。", menu: "登录" },
      { t: "以 root 登录", d: "在已种子的系统上使用 **root@demo.test** / **Demo1234!**。生产环境请使用您创建的超级管理员。", menu: "登录" },
      { t: "启用 2FA", d: "Admin+ 必须注册 TOTP。打开 **账户 → 安全**，用验证器扫描二维码并确认一次性代码。", menu: "账户 → 安全", shot: "admin-security.png" },
      { t: "检查审计日志", d: "打开 **管理 → 审计日志** 并运行 **验证审计链**。必须返回 ok。", menu: "管理 → 审计日志" },
      { t: "打开设置", d: "进入 **管理 → 设置**，在创建真实数据前确认组织、区域（货币/时区/语言）和计费。", menu: "管理 → 设置" }
    ]
  },
  {
    id: "real-admin",
    title: "👤 创建您的真实超级管理员",
    role: "超级管理员",
    time: "约 8 分钟",
    intro: "切勿在 *@demo.test 上跑生产。创建实名管理员，然后禁用演示账号。",
    steps: [
      { t: "用户 → 新建用户", d: "打开 **管理 → 用户**，用真实邮箱和临时密码创建用户。", menu: "管理 → 用户 → 新建" },
      { t: "分配超级管理员", d: "为新用户授予 **超级管理员** 角色（GLOBAL）。有效权限是所有角色的并集。", menu: "用户 → 角色" },
      { t: "以自己登录", d: "退出后以新用户登录，启用 **2FA** 并修改临时密码。", menu: "登录" },
      { t: "禁用演示账号", d: "禁用或重设每个 `*@demo.test` 账号。演示数据仅供培训。", menu: "管理 → 用户" },
      { t: "撤销残留会话", d: "在 **安全** 中撤销演示用户的会话，防止他们保持登录。", menu: "管理 → 安全" }
    ]
  },
  {
    id: "cashier-role",
    title: "🛡️ 创建收银员角色",
    role: "管理员 / 超级管理员",
    time: "约 10 分钟",
    intro: "最小权限：收银员可以记录收款，但不能编辑账单。",
    steps: [
      { t: "角色 → 新建角色", d: "进入 **管理 → 角色与权限**，将角色命名为 **Cashier**。", menu: "管理 → 角色 → 新建" },
      { t: "勾选权限网格", d: "授予 **M09 收款** 在 **PROPERTY** 范围的操作写入。其余模块全部关闭。", menu: "角色 → 权限网格" },
      { t: "保存角色", d: "角色/权限变更会被 **审计**。正在使用的角色不能删除。", menu: "角色 → 保存" },
      { t: "分配角色 + 物业", d: "打开收银员用户，分配 **Cashier**，并分配其可收款的 **物业**。", menu: "用户 → 角色 + 物业" },
      { t: "反向验证", d: "以收银员登录：可以记录收款，但打开账单编辑会返回 **403**。", menu: "验证" }
    ]
  },
  {
    id: "onboard-employee",
    title: "🧑‍💼 新员工入职",
    role: "管理员",
    time: "约 8 分钟",
    intro: "创建账号、强制改密，并分配其所需的最小权限。",
    steps: [
      { t: "用户 → 新建用户", d: "填写姓名、**邮箱** 和临时密码。账号带有 **mustChangePassword**。", menu: "管理 → 用户 → 新建" },
      { t: "分配角色", d: "选择能工作的最小角色（员工、会计、物业经理…）。权限是所有角色的 **并集**。", menu: "用户 → 角色" },
      { t: "分配物业", d: "PROPERTY 范围角色（经理/员工）必须分配物业。GLOBAL 角色可见全部物业。", menu: "用户 → 物业" },
      { t: "交接凭证", d: "告知 URL + 临时密码。Admin+ 还必须启用 **2FA** 后其他模块才可用。", menu: "交接" },
      { t: "确认首次登录", d: "对方设置自己的密码；在 **审计日志** 中确认创建 + 首次登录。", menu: "管理 → 审计日志" }
    ]
  },
  {
    id: "offboard-employee",
    title: "🚪 员工离职",
    role: "管理员",
    time: "约 5 分钟",
    intro: "四步都要做 — 仅禁用不够，会话或 2FA 可能仍然有效。",
    steps: [
      { t: "禁用用户", d: "将 **status = disabled**。立即阻止登录。", menu: "管理 → 用户" },
      { t: "撤销会话", d: "从 **安全** / 用户记录强制所有设备退出。", menu: "安全 → 会话" },
      { t: "重置 2FA", d: "若以后可能重新启用此账号，现在就重置 2FA，让旧验证码失效。", menu: "安全 → 重置 2FA" },
      { t: "复查审计轨迹", d: "按该操作者筛选 **审计日志**，做最后一次审查。", menu: "管理 → 审计日志" }
    ]
  },
  {
    id: "org-setup",
    title: "🏢 组织搭建（黄金顺序）",
    role: "超级管理员",
    time: "约 45 分钟",
    intro: "每一步解锁下一步。不要跳过区域/货币 — 有数据后不可更改。",
    steps: [
      { t: "组织 + 区域", d: "设置 → **组织**（法定名称、徽标）和 **区域**（货币、时区、语言）。**货币只设一次**。", menu: "设置 → 组织 / 区域" },
      { t: "物理库存", d: "创建 **物业 → 楼栋 → 楼层 → 房间 → 床位**（M04）。", menu: "资产组合 → 物业" },
      { t: "角色与用户", d: "确认默认角色，添加真实用户，分配角色 + 物业。", menu: "管理 → 角色、用户" },
      { t: "租金引擎与计费", d: "方案、滞纳金、税、账单前缀、宽限/催收天数。", menu: "租金引擎 · 设置 → 计费" },
      { t: "密钥与支付", d: "存储支付提供商和 Telegram 密钥（密封）。若在迁移则录入期初余额。", menu: "设置 → 密钥" },
      { t: "业主、Telegram、开关", d: "业主合同 + 付款方式；Telegram 机器人；功能开关 + 报表分配。", menu: "业主 · Telegram · 功能" },
      { t: "黄金路径测试", d: "租约 → 账单 → 收款 → 收据。然后安排备份并复查审计日志。", menu: "端到端测试" }
    ]
  },
  {
    id: "settings",
    title: "⚙️ 配置设置（M28）",
    role: "管理员 / 超级管理员",
    time: "约 15 分钟",
    intro: "所有变更都会被审计。财务设置只向前生效 — 已过账历史永不改写。",
    steps: [
      { t: "打开 管理 → 设置", d: "下列分组都在此屏幕。", menu: "管理 → 设置" },
      { t: "组织品牌", d: "法定名称、地址、税号、徽标、账单页脚、PDF 模板。会印在每张收据上。", menu: "设置 → 组织" },
      { t: "区域", d: "货币、时区、界面语言（en/km/zh）。⚠️ 货币在上线时 **只设一次**。", menu: "设置 → 区域" },
      { t: "计费与滞纳金", d: "账单前缀、宽限天数（默认 3）、催收 [3,7,14]。滞纳金默认关闭 — 若开启务必设 **上限**。", menu: "设置 → 计费 / 滞纳金" },
      { t: "功能、报表、模板", d: "隐藏未用模块（数据保留），分配角色可见的报表，覆盖 Telegram 文案。", menu: "设置 → 功能 / 报表 / 模板" },
      { t: "密钥", d: "支付凭证和 Telegram token 以 **AES-256-GCM 密封**，读取时掩码。切勿在聊天中粘贴密钥。", menu: "设置 → 密钥" }
    ]
  },
  {
    id: "jobs",
    title: "⏰ 安排夜间任务",
    role: "管理员 / IT",
    time: "约 15 分钟",
    intro: "任务是 HTTP 端点。用专用服务账号 cookie 按计划调用 — 切勿用个人登录。",
    steps: [
      { t: "创建服务账号", d: "管理员角色、超长随机密码、已启用 2FA，凭证放在服务器保险库。", menu: "管理 → 用户" },
      { t: "每个任务先试跑一次", d: "POST `/api/jobs/billing-daily`、`backup`、`rent-alerts`、`invoice-generation`、`statement-generation`、`telegram-dispatch`、`sla-sweep`、`attendance-sweep`、`retention`。检查审计行。", menu: "Jobs API" },
      { t: "添加 cron（Mac/Linux）", d: "例如：`0 2 * * * curl -sf -X POST http://localhost:3000/api/jobs/backup -H \"Cookie: $RM_ADMIN_COOKIE\"`。", menu: "crontab" },
      { t: "或任务计划程序（Windows）", d: "用 PowerShell 运行 `Invoke-RestMethod -Method Post` — 见 DEPLOY_WINDOWS.md。", menu: "任务计划程序" },
      { t: "确认备份卷", d: "夜间转储备份在 `/app/backups` → `rentmanager-backups` 卷。保留最新 **7** 份。", menu: "备份目录" }
    ]
  },
  {
    id: "backup",
    title: "💾 备份并试恢复",
    role: "管理员 / IT",
    time: "约 20 分钟",
    intro: "未经测试的备份不算备份。上线前做一次，之后每季度一次。",
    steps: [
      { t: "运行备份任务", d: "POST `/api/jobs/backup`（需要 M27:update）。生成 `pg_dump` 自定义格式文件。", menu: "POST /api/jobs/backup" },
      { t: "确认文件", d: "查找 `backups/backup-<timestamp>.dump`（容器路径 `/app/backups`）。", menu: "backups/" },
      { t: "停止应用", d: "`docker compose stop rentmanager`，避免恢复期间有写入。", menu: "docker compose stop" },
      { t: "恢复到旁路数据库", d: "`createdb rentmanager_restore && pg_restore --dbname=rentmanager_restore backups/<file>.dump`，然后 `npx prisma migrate deploy`。", menu: "pg_restore" },
      { t: "验证", d: "`GET /api/health` → 200 · `GET /api/audit/verify` → `{ok:true}` · 收款报表对得上。MinIO/S3 桶需另行备份。", menu: "健康检查 + 审计验证" }
    ]
  },
  {
    id: "harden",
    title: "🔒 上线前安全加固",
    role: "超级管理员 / IT",
    time: "约 30 分钟",
    intro: "构建已有坚实基线。生产仍需轮换所有默认密钥并启用 HTTPS。",
    steps: [
      { t: "轮换所有密钥", d: "更改 `FILE_SIGNING_SECRET`、`PAYMENT_WEBHOOK_SECRET`、`SETTINGS_ENC_KEY`（32+ 随机字节），以及 Telegram/DB/Redis/MinIO/Grafana/Nacos/Keycloak 密码。", menu: "环境变量" },
      { t: "清除演示账号", d: "禁用或重设所有 `*@demo.test` 用户。为每位 Admin+ 启用 **2FA**。", menu: "管理 → 用户" },
      { t: "HTTPS + 安全 Cookie", d: "设置 `COOKIE_SECURE=true`，前面加 TLS 反向代理，将 `APP_BASE_URL` 设为公开 https URL。", menu: "代理 / 环境" },
      { t: "绑定内部端口", d: "PostgreSQL、Redis、Kafka、Nacos、Keycloak、MinIO API **不得**暴露到公网。", menu: "防火墙" },
      { t: "验证完整性", d: "运行 **验证审计链**，对支付/Telegram webhook 做伪造测试（必须拒绝），安排夜间备份 + 一次试恢复。", menu: "审计 · webhook · 备份" }
    ]
  },
  {
    id: "audit",
    title: "📜 验证审计链",
    role: "管理员 / 超级管理员",
    time: "约 5 分钟",
    intro: "轨迹是哈希链式且永不清除。验证失败属于必须停线的事件。",
    steps: [
      { t: "打开审计日志", d: "进入 **管理 → 审计日志**。调查时可按操作者、日期或实体筛选。", menu: "管理 → 审计日志" },
      { t: "运行验证审计链", d: "`GET /api/audit/verify` 必须返回 `{ ok: true }`。", menu: "验证" },
      { t: "若失败 — 停止", d: "可能被篡改。不要盲目恢复：先查根因，再从已知完好的备份恢复。", menu: "事故" },
      { t: "用冲正来更正", d: "切勿手工改已过账账单/收款/分类账。使用贷项通知单 / 作废 / 退款，以保持轨迹完整。", menu: "冲正，而非编辑" }
    ]
  },
  {
    id: "update",
    title: "🚀 更新系统",
    role: "管理员 / IT",
    time: "约 20 分钟",
    intro: "先快照。迁移只追加 — 向前滚动，若必须回退则从备份恢复。",
    steps: [
      { t: "快照", d: "拉取前先运行备份任务（或快照 Docker 卷）。", menu: "POST /api/jobs/backup" },
      { t: "拉取并重建", d: "`git pull` 然后 `docker compose up --build -d`。生产环境钉死镜像标签 / 提交 SHA。", menu: "docker compose up --build -d" },
      { t: "观察入口脚本", d: "迁移 + 种子自动运行。首次启动时跟随 `docker compose logs -f rentmanager`。", menu: "logs -f rentmanager" },
      { t: "健康检查", d: "`curl -sf http://localhost:3000/api/health` 和 `docker compose ps`。确认 `/admin-guide` 仍可加载。", menu: "GET /api/health" }
    ]
  }
];

export const DIAGRAMS = {
  "02-architecture": {
    "21-components": {
      cap: "技术栈如何连接",
      nodes: [
        ["v-blue", "浏览器 — 员工 / 门户"],
        ["rentmanager :3000（Next.js + Prisma）"],
        ["PostgreSQL :5432"],
        ["gateway :8080 → Spring 服务 :8081–:8088"],
        ["v-teal", "Nacos · Keycloak · Kafka · Redis · MinIO · Grafana"]
      ]
    }
  },
  "04-rbdc": {
    "41-the-model-read-this-once-use-it-forever": {
      cap: "权限 = 模块 × 动作 × 范围",
      nodes: [
        ["v-blue", "MODULE（M01–M33）"],
        ["ACTION — create read update delete approve void refund export config"],
        ["SCOPE — GLOBAL / PROPERTY / OWN"],
        ["v-green", "有效权限 = 用户所有角色的并集"],
        ["API 才是真正的闸门 — UI 只是隐藏按钮"]
      ]
    }
  },
  "06-organisation-setup": {
    "golden-setup-order": {
      cap: "新组织的搭建顺序",
      nodes: [
        ["1 · 组织 / 区域（货币只设一次）"],
        ["2 · 物业 → 楼栋 → 楼层 → 房间"],
        ["3 · 角色 · 4 · 用户（角色 + 物业）"],
        ["5 · 租金引擎 · 6 · 期初余额"],
        ["7 · 支付方式与密钥 · 8 · 计费 / 提醒"],
        ["9 · 业主 + 合同 · 10 · Telegram"],
        ["11 · 安全（2FA、会话） · 12 · 功能开关"],
        ["v-green", "13 · 黄金路径测试 · 14 · 审计 + 备份"]
      ]
    }
  },
  "10-backup-restore": {
    "backup-and-restore": {
      cap: "恢复顺序（很重要）",
      nodes: [
        ["v-amber", "1 · docker compose stop rentmanager"],
        ["2 · pg_restore 到旁路数据库"],
        ["3 · npx prisma migrate deploy（只向前）"],
        ["v-green", "4 · health 200 · 审计验证 ok · 报表对账"]
      ]
    }
  },
  "11-security-hardening": {
    "before-production": {
      cap: "真实资金进入前的加固",
      nodes: [
        ["轮换所有默认密钥"],
        ["禁用 *@demo.test · 为 Admin+ 启用 2FA"],
        ["HTTPS + COOKIE_SECURE=true"],
        ["将 DB/Redis/Kafka/MinIO 绑定到私网"],
        ["v-teal", "验证审计链 · 夜间备份 · 试恢复"]
      ]
    }
  },
  "15-go-live": {
    "go-live-checklist": {
      cap: "上线一图",
      nodes: [
        ["部署绿灯 · §11 加固完成"],
        ["组织 / 区域 / 计费已定 · 房间已录入"],
        ["真实用户 + 角色 · 演示账号已禁用"],
        ["任务已排程并试跑 · 备份已恢复一次"],
        ["v-green", "员工已培训 租约 → 账单 → 收款 → 退房"]
      ]
    }
  }
};
