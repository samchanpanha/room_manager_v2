# 第 15 部分 — 部署指南（macOS 与 Windows）

本部分介绍如何在 Apple Mac 或 Windows PC 上**安装并运行 RentManager**。有一条
推荐路径 — **Docker**（一条命令启动整个系统）— 以及一条**轻量**路径（仅应用 +
数据库），适合配置较低的机器与日常开发。

> 部署完成后，请继续阅读**第 8 部分（管理员指南）**：首次登录、组织设置、用户、
> 安全与备份。本指南附带一页可打印摘要：
> [管理员速查表](cheat-sheet.html)。

---

## 15.1 系统要求

### 硬件

| | 最低配置 | 推荐配置（完整 Docker 栈） |
|---|---|---|
| 内存 | 8 GB | **16 GB**（整个栈约 20 个容器：Java 服务、Kafka、Keycloak……） |
| CPU | 2 核 | 4 核以上（Windows：需在 BIOS 中启用虚拟化 VT-x/AMD-V） |
| 磁盘 | 20 GB 可用空间 | 40 GB 以上可用 SSD（Windows 需 25–50 GB：WSL2 磁盘 + 镜像 + 数据库） |

> 💡 内存不足？请使用**轻量方案（§15.4）** — 仅应用 + PostgreSQL（约 1 GB）。
> 您仍然可以获得带演示数据的完整 RentManager Web 应用。

### 软件

| # | 要求 | macOS | Windows |
|---|---|---|---|
| 1 | 操作系统 | macOS 12 (Monterey) 或更新版本 | Windows 10 64 位 21H2+ / Windows 11 |
| 2 | **Docker Desktop 4.x** | 从 docker.com 下载 Apple Silicon **或** Intel 版本 | Windows 安装包 + **WSL 2 + Ubuntu**（`wsl --install`） |
| 3 | **Git** | `xcode-select --install` | Git for Windows（附带 Git Bash） |
| 4 | Node.js 20/22 *（仅轻量方案）* | `brew install node@22` | 从 nodejs.org 下载 LTS 安装包 |
| 5 | PostgreSQL 16 *（仅轻量方案）* | `brew install postgresql@16` — 或 `docker compose up -d postgres` | EDB 安装包 — 或 `docker compose up -d postgres` |

### 必须空闲的端口

`3000`（应用）· `5432`（postgres）· `6379`（redis）· `8080–8088`（网关 +
服务）· `8848/9848/9849`（nacos）· `7080`（keycloak）· `8090/8091`
（kafka ui/registry）· `9090`（grafana）· `9092`（kafka）· `9000/9001`（minio）。
轻量方案仅需 `3000` + `5432`。

### 需要的知识

会打开**终端**（Mac）或 **PowerShell**（Windows）、复制粘贴命令，
并在浏览器中打开 `http://localhost:…`。无需 Docker 经验。

---

## 15.2 在 macOS 上部署（Docker — 推荐）

### 第 1 步 — 安装 Docker Desktop

1. 从 **docker.com/products/docker-desktop** 下载 — 根据您的 Mac 选择
   **Apple Silicon** 或 **Intel 芯片**版本（ → 关于本机 → 芯片）。
2. 打开 `.dmg`，将 **Docker** 拖到应用程序文件夹，启动它，等待菜单栏中的
   鲸鱼图标停止转动。
3. 在终端中验证：
   ```bash
   docker --version
   docker compose version
   ```
4. **给 Docker 足够的内存（重要！）：** Docker Desktop → ⚙ 设置 →
   **Resources** → **内存 ≥ 8 GB**（若有 16 GB 则设 10–12 GB），CPU ≥ 4 →
   **Apply & restart**。

### 第 2 步 — 安装 Git

```bash
xcode-select --install
git --version
```

### 第 3 步 — 克隆仓库

```bash
cd ~
git clone <YOUR-REPO-URL> room_manager_v2
cd room_manager_v2
```

### 第 4 步 —（推荐）设置密钥

本地演示可跳过 — 内置的开发默认值足够安全。用于共享环境时，请在**首次
启动前**覆盖默认值：

```bash
cp .env.example .env   # 按需编辑其中的值
export MINIO_ROOT_PASSWORD="change-me-minio-32chars-min"
export GRAFANA_ADMIN_PASSWORD="change-me-grafana"
# 然后在同一个 shell 中执行第 5 步
```

### 第 5 步 — 构建并启动一切（一条命令）

```bash
docker compose up --build -d
```

- 首次运行会下载镜像并构建 Java + Next.js 应用 — 预计 **10–30 分钟**
 （之后启动约 1–2 分钟）。`-d` = 后台运行。
- 查看进度：`docker compose ps` 和 `docker compose logs -f rentmanager`。
- 应用容器会自动**等待 PostgreSQL → 运行迁移 → 写入演示数据
 （幂等）→ 在 3000 端口启动**。

继续**§15.5 验证安装**。

---

## 15.3 在 Windows 上部署（Docker — 推荐）

> 🗒️ 以下命令适用于 **PowerShell**。仅在标有 **[ADMIN]** 处使用**管理员身份**
> 运行。Git Bash 和 WSL Ubuntu 也可用 — 任选一种终端即可。

### 第 1 步 — 启用 WSL 2 [ADMIN]

1. 开始菜单 → 输入 `PowerShell` → 右键 → **以管理员身份运行**。
2. 安装 WSL + Ubuntu（提示时重启，然后打开一次 **Ubuntu** 以创建
   Linux 用户名/密码）：
   ```powershell
   wsl --install
   ```
3. 确认是版本 2：`wsl --list --verbose`（必须显示 `VERSION 2`；若显示 1：
   `wsl --set-version Ubuntu 2`）。若因虚拟化报错，请在 BIOS/UEFI 中启用
   **VT-x / AMD-V** 后重试。

### 第 2 步 — 安装 Docker Desktop

1. 运行 docker.com 的 **Windows** 安装包（保持 **"Use WSL 2 instead
   of Hyper-V"** 勾选），按提示重启，启动 Docker Desktop。
2. 等待托盘鲸鱼图标稳定，然后验证：
   ```powershell
   docker --version
   docker compose version
   ```
3. Docker Desktop → ⚙ 设置 → **Resources** → **内存 ≥ 8 GB**，
   CPU ≥ 4 → **Apply & restart**。

### 第 3 步 — 安装 Git for Windows

从 git-scm.com 安装（保持默认），然后在**新** PowerShell 窗口中执行：
`git --version`。

### 第 4 步 — 克隆仓库

```powershell
cd $HOME
git clone <YOUR-REPO-URL> room_manager_v2
cd room_manager_v2
```

> ⚠️ 请克隆到**短且无空格的路径**，如 `C:\Users\<you>\room_manager_v2`
> （长路径 + 空格会导致奇怪的失败）。

### 第 5 步 —（推荐）设置密钥

```powershell
Copy-Item .env.example .env
$env:MINIO_ROOT_PASSWORD="change-me-minio-32chars-min"
$env:GRAFANA_ADMIN_PASSWORD="change-me-grafana"
# 然后在同一个窗口中执行第 6 步
```

### 第 6 步 — 构建并启动一切（一条命令）

```powershell
docker compose up --build -d
```

- 首次构建需要 **15–40 分钟**；之后启动约 1–2 分钟。
- 查看进度：`docker compose ps` 和 `docker compose logs -f rentmanager`
 （等待 → 迁移 → 写入种子数据 → 启动，全自动）。

继续**§15.5 验证安装**。

---

## 15.4 轻量方案：仅应用 + 数据库

适合日常开发或配置较低的机器：PostgreSQL 跑在 Docker（或本机）中，
Next.js 应用直接用 Node 运行。您将获得**带演示数据的完整 Web 应用** —
仅缺少 Java 微服务/Kafka/Keycloak 等附加组件。

### macOS

```bash
brew install node@22 git
git clone <YOUR-REPO-URL> room_manager_v2 && cd room_manager_v2
npm install
docker compose up -d postgres   # 仅启动数据库
cp .env.example .env            # 检查 DATABASE_URL 指向 localhost:5432
npx prisma generate
npx prisma migrate deploy
npm run db:seed                 # 演示数据（幂等）
npm run dev                     # → http://localhost:3000
```

（完全不用 Docker？`brew install postgresql@16 && brew services start
postgresql@16`，然后 `createuser -s rentmanager` + `createdb -O rentmanager
rentmanager`。）

### Windows（PowerShell）

```powershell
# 1. 从 nodejs.org 安装 Node.js LTS，然后在新窗口中执行：
node --version                  # 应为 v20.x 或 v22.x
# 2. 安装 PostgreSQL 16（EDB 安装包，端口 5432），然后创建角色 + 数据库：
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE USER rentmanager WITH PASSWORD 'rentmanager' SUPERUSER;"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE rentmanager OWNER rentmanager;"
# （备选：跳过安装包 — 执行 `docker compose up -d postgres`）
# 3. 克隆 + 运行：
cd $HOME
git clone <YOUR-REPO-URL> room_manager_v2; cd room_manager_v2
npm install
Copy-Item .env.example .env
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev                     # → http://localhost:3000
```

按 `Ctrl+C` 停止开发服务器。常用命令：`npm run lint`、
`npm run typecheck`、`npm test`、`npm run db:seed:demo`（更完整的演示数据）。

---

## 15.5 验证安装

```bash
docker compose up -d --wait     # 阻塞等待所有健康检查通过
curl -sf http://localhost:3000/api/health && echo " APP OK"
```

（Windows PowerShell：`curl.exe -sf http://localhost:3000/api/health` —
返回 JSON `{"status":"ok",…}` 即为健康。）

| 项目 | URL | 登录（默认值 — 投产前请修改！） |
|---|---|---|
| **RentManager 应用** | http://localhost:3000 | `root@demo.test` / `Demo1234!` |
| API 文档（Swagger） | http://localhost:8080/swagger-ui.html | — |
| Nacos | http://localhost:8848/nacos | `nacos` / `nacos` |
| Keycloak | http://localhost:7080 | `admin` / `admin` |
| Kafka UI | http://localhost:8090 | — |
| MinIO 文件 | http://localhost:9001 | `rentmanager` / `rentmanager-s3-secret` |
| Grafana | http://localhost:9090 | `admin` / `admin` |

✅ **成功标准 =** 登录页正常加载，`root@demo.test` 可以登录，
仪表盘显示演示物业。

---

## 15.6 首次登录与后续步骤

1. 打开 **http://localhost:3000/login**，以 `root@demo.test`
   （密码 `Demo1234!`）登录。其他演示账号：`admin@`、`pm@`、
   `accountant@`、`staff@`、`owner@`、`owner2@`、`member@demo.test` — 密码相同。
2. 注册 **2FA**（Admin 及以上强制要求）：Account → Security。
3. 为自己创建一个**真实的超级管理员**，然后在投产前**禁用或修改所有
   `*@demo.test` 账号的密码**。
4. 按**第 8 部分 §8.7（管理员黄金路径）**操作：组织/区域 → 物业 →
   用户/角色 → 计费 → 业主 → Telegram → 安全 → 备份。
5. 安排**每夜备份**（§15.8）— 第一天就要做。

> ⚠️ 演示数据仅用于培训。切勿在其上运行真实资金 — 投产请全新部署，
> 并修改**所有**默认密钥（第 9 部分 + Admin Guide §11）。

---

## 15.7 日常命令

```bash
docker compose ps                    # 查看所有容器状态
docker compose logs -f rentmanager   # 跟随应用日志（Ctrl+C 退出）
docker compose logs -f gateway       # 跟随 API 网关日志
docker compose stop                  # 停止所有（数据保留）
docker compose start                 # 重新启动
docker compose down                  # 停止并删除容器（数据保留）
docker compose down -v               # ⚠️ 停止并删除所有数据（全新开始）
```

（macOS 终端、PowerShell、Git Bash 与 WSL 中命令相同。）

---

## 15.8 定时任务

应用提供 cron 风格的任务接口 — 请用 Admin 会话/令牌按计划调用。
以下三个必须从第一天就排好：

| 任务 | 接口 | 典型计划 |
|---|---|---|
| `billing-daily` | `POST /api/jobs/billing-daily` | 每天约 01:00 |
| `backup` | `POST /api/jobs/backup`（**每夜 — 不可跳过！**） | 每天约 02:00 |
| `rent-alerts` | `POST /api/jobs/rent-alerts` | 每天约 06:00 |

另有每月 `invoice-generation`（账单日）与 `statement-generation`
（付款日）；每天/每小时 `telegram-dispatch`；每天 `sla-sweep`、
`attendance-sweep`、`retention`。完整表格：Admin Guide §9。

**macOS/Linux cron**（`crontab -e`，使用专用的 Admin 服务账号）：

```bash
0 1 * * * curl -sf -X POST http://localhost:3000/api/jobs/billing-daily -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 2 * * * curl -sf -X POST http://localhost:3000/api/jobs/backup        -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 6 * * * curl -sf -X POST http://localhost:3000/api/jobs/rent-alerts   -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
```

**Windows 任务计划程序：** 保存一个使用
`Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs/backup …`
的 `invoke-jobs.ps1`，然后创建基本任务 → 每天 02:00 → 启动程序 `powershell.exe`，
参数为 `-ExecutionPolicy Bypass -File C:\RentManager\jobs\invoke-jobs.ps1`。

---

## 15.9 更新与卸载

### 更新到新版本

```bash
cd ~/room_manager_v2        # Windows：cd $HOME\room_manager_v2
git pull
docker compose up --build -d
curl -sf http://localhost:3000/api/health && echo " APP OK"
```

迁移在启动时自动运行，且为**仅追加**（可安全地应用于旧快照；
不支持回滚 — 请改用备份恢复）。

### 卸载

- 停止：`docker compose down`（数据保留在数据卷中；`down -v` 会删除数据）。
- 按操作系统常规方式卸载 Docker Desktop；删除仓库文件夹。
- macOS：`rm -rf ~/room_manager_v2`（若同时清除 Docker 数据，再加 `~/.docker`）。

---

## 15.10 故障排除

| 问题 | 解决方法 |
|---|---|
| `Cannot connect to the Docker daemon` | 打开 Docker Desktop，等待鲸鱼图标稳定；Windows：设置 → General → ✅ **Use the WSL 2 based engine** |
| 构建极慢 / 容器 OOM 被杀 | Docker 设置 → Resources → 内存 **≥ 8 GB**，CPU ≥ 4 → Apply & restart；构建时关闭重型应用 |
| `port is already allocated` | Mac：`lsof -i :3000` → `kill <PID>`。Windows：`netstat -ano \| findstr :3000` → `taskkill /PID <pid> /F`。常见元凶：第二个 Postgres（Mac：`brew services stop postgresql@16`；Windows：服务 → `postgresql-x64-16` → 停止） |
| WSL 报错 / VERSION 1（Windows） | 在 BIOS 中启用 VT-x/AMD-V；[ADMIN] `dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart` + 重启；`wsl --update`；`wsl --set-version Ubuntu 2` |
| 应用一直 "waiting for database" | `docker compose ps` → `postgres` 健康吗？查看 `docker compose logs postgres`；确认 5432 端口未被占用 |
| 登录页能开但登录失败 | 查看 `docker compose logs --tail=100 rentmanager`（可能是种子数据失败）；确认 `/api/health` 返回 200 |
| Apple Silicon 镜像警告 | 镜像均为多架构 — 无需处理；可选：在 Docker 设置中启用 **Rosetta for x86_64 emulation** |
| `npm install` EPERM / 路径错误（Windows） | 把仓库移到短路径（`C:\Users\<you>\room_manager_v2`）；将其排除在杀毒软件实时扫描之外 |
| 磁盘满 | `docker system df` → `docker system prune`；删除旧的 `backups/*.dump`；Windows：`wsl --shutdown` 后压缩 Docker 的 `.vhdx` |
| 时钟漂移导致会话失效（WSL 休眠后） | 执行 `wsl --shutdown`，重新打开 Docker |

仍未解决？收集 `docker compose ps` + `docker compose logs --tail=100
rentmanager` — 它们能定位 90% 的问题。最终用户问题 → **第 10 部分**。
