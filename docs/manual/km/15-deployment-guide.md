# ផ្នែកទី ១៥ — មគ្គុទ្ទេសក៍ការដំឡើងប្រព័ន្ធ (macOS & Windows)

ផ្នែកនេះពន្យល់ពីរបៀប **ដំឡើង និងដំណើរការ RentManager** លើកុំព្យូទ័រ Mac របស់
Apple ឬ PC Windows។ មានផ្លូវដែលបានណែនាំមួយ — **Docker** (ប្រព័ន្ធទាំងមូលដោយ
ពាក្យបញ្ជាតែមួយ) — បូកនឹងផ្លូវ **ស្រាល** (មានតែ app + database) សម្រាប់ម៉ាស៊ីន
តូច និងការសរសេរកូដប្រចាំថ្ងៃ។

> បន្ទាប់ពីដំឡើងរួច សូមបន្តទៅ **ផ្នែកទី ៨ (មគ្គុទ្ទេសក៍អ្នកគ្រប់គ្រង)**៖ ការចូល
> លើកដំបូង, ការរៀបចំអង្គភាព, អ្នកប្រើប្រាស់, សុវត្ថិភាព និងការបម្រុងទុក។
> សេចក្តីសង្ខេបមួយទំព័រដែលអាចបោះពុម្ពបានភ្ជាប់មកជាមួយមគ្គុទ្ទេសក៍នេះ៖
> [សន្លឹកជំនួយអ្នកគ្រប់គ្រង](cheat-sheet.html)។

---

## 15.1 តម្រូវការ

### ផ្នែករឹង (Hardware)

| | អប្បបរមា | បានណែនាំ (Docker ពេញលេញ) |
|---|---|---|
| RAM | 8 GB | **16 GB** (ប្រព័ន្ធដំណើរការ container ~២០៖ សេវា Java, Kafka, Keycloak…) |
| CPU | 2 cores | 4+ cores (Windows៖ បើក virtualization VT-x/AMD-V ក្នុង BIOS) |
| ថាស | ទំនេរ 20 GB | ទំនេរ 40 GB+ SSD (Windows ២៥–៥០ GB៖ ថាស WSL2 + images + DB) |

> 💡 RAM មិនគ្រប់គ្រាន់? សូមប្រើ **ជម្រើសស្រាល (§15.4)** — មានតែ app +
> PostgreSQL (≈1 GB)។ អ្នកនៅតែទទួលបាន web app RentManager ពេញលេញជាមួយទិន្នន័យសាកល្បង។

### ផ្នែកទន់ (Software)

| # | តម្រូវការ | macOS | Windows |
|---|---|---|---|
| 1 | OS | macOS 12 (Monterey) ឬថ្មីជាង | Windows 10 64-bit 21H2+ / Windows 11 |
| 2 | **Docker Desktop 4.x** | ជំនាន់ Apple Silicon **ឬ** Intel ពី docker.com | កម្មវិធីដំឡើង Windows + **WSL 2 + Ubuntu** (`wsl --install`) |
| 3 | **Git** | `xcode-select --install` | Git for Windows (មាន Git Bash ភ្ជាប់មក) |
| 4 | Node.js 20/22 *(តែជម្រើសស្រាល)* | `brew install node@22` | កម្មវិធីដំឡើង LTS ពី nodejs.org |
| 5 | PostgreSQL 16 *(តែជម្រើសស្រាល)* | `brew install postgresql@16` — ឬ `docker compose up -d postgres` | កម្មវិធីដំឡើង EDB — ឬ `docker compose up -d postgres` |

### Port ដែលត្រូវទំនេរ

`3000` (app) · `5432` (postgres) · `6379` (redis) · `8080–8088` (gateway +
services) · `8848/9848/9849` (nacos) · `7080` (keycloak) · `8090/8091`
(kafka ui/registry) · `9090` (grafana) · `9092` (kafka) · `9000/9001` (minio)។
ជម្រើសស្រាលត្រូវការតែ `3000` + `5432`។

### ចំណេះដឹងដែលត្រូវការ

បើក **Terminal** (Mac) ឬ **PowerShell** (Windows), ចម្លងពាក្យបញ្ជា,
និងបើក `http://localhost:…` ក្នុង browser។ មិនចាំបាច់ចេះ Docker ទេ។

---

## 15.2 ការដំឡើងលើ macOS (Docker — បានណែនាំ)

### ជំហានទី ១ — ដំឡើង Docker Desktop

1. ទាញយកពី **docker.com/products/docker-desktop** — ជ្រើស **Mac with
   Apple Silicon** ឬ **Mac with Intel chip** ឲ្យត្រូវនឹង Mac របស់អ្នក ( → About This Mac → Chip)។
2. បើកឯកសារ `.dmg`, អូស **Docker** ទៅ Applications, ដំណើរការវា ហើយរង់ចាំរូប
   ត្រីបាឡែនក្នុង menu bar ឈប់វិល។
3. ផ្ទៀងផ្ទាត់ក្នុង Terminal៖
   ```bash
   docker --version
   docker compose version
   ```
4. **ផ្តល់ memory ឲ្យ Docker ឲ្យគ្រប់គ្រាន់ (សំខាន់!):** Docker Desktop → ⚙ Settings →
   **Resources** → **Memory ≥ 8 GB** (10–12 GB ប្រសិនបើមាន 16 GB), CPUs ≥ 4 →
   **Apply & restart**។

### ជំហានទី ២ — ដំឡើង Git

```bash
xcode-select --install
git --version
```

### ជំហានទី ៣ — Clone repository

```bash
cd ~
git clone <YOUR-REPO-URL> room_manager_v2
cd room_manager_v2
```

### ជំហានទី ៤ — (បានណែនាំ) កំណត់ secrets

សម្រាប់ demo ក្នុងម៉ាស៊ីនផ្ទាល់ខ្លួន អ្នកអាចរំលងបាន — តម្លៃលំនាំដើមមានសុវត្ថិភាព
គ្រប់គ្រាន់។ សម្រាប់ការប្រើរួមគ្នា សូមប្តូរតម្លៃលំនាំដើម **មុន** boot លើកដំបូង៖

```bash
cp .env.example .env   # កែតម្លៃខាងក្នុងតាមត្រូវការ
export MINIO_ROOT_PASSWORD="change-me-minio-32chars-min"
export GRAFANA_ADMIN_PASSWORD="change-me-grafana"
# បន្ទាប់មកដំណើរការជំហានទី ៥ ក្នុង shell ដដែល
```

### ជំហានទី ៥ — Build និងដំណើរការទាំងអស់ (ពាក្យបញ្ជាតែមួយ)

```bash
docker compose up --build -d
```

- លើកដំបូងត្រូវទាញយក images និង build app Java + Next.js — ប្រហែល
  **១០–៣០ នាទី** (លើកបន្ទាប់ ~១–២ នាទី)។ `-d` = ដំណើរការក្នុង background។
- មើលវឌ្ឍនភាព៖ `docker compose ps` និង `docker compose logs -f rentmanager`។
- container app ធ្វើដោយស្វ័យប្រវត្តិ **រង់ចាំ PostgreSQL → ដំណើរការ migrations →
  បញ្ចូលទិន្នន័យសាកល្បង (idempotent) → ចាប់ផ្តើមលើ port 3000**។

បន្តទៅ **§15.5 ផ្ទៀងផ្ទាត់ការដំឡើង**។

---

## 15.3 ការដំឡើងលើ Windows (Docker — បានណែនាំ)

> 🗒️ ពាក្យបញ្ជាខាងក្រោមសម្រាប់ **PowerShell**។ ដំណើរការជា **Administrator**
> តែ where មានសម្គាល់ **[ADMIN]**។ Git Bash និង WSL Ubuntu ក៏ប្រើបាន — ជ្រើសមួយ។

### ជំហានទី ១ — បើក WSL 2 [ADMIN]

1. Start menu → វាយ `PowerShell` → ចុចស្តាំ → **Run as administrator**។
2. ដំឡើង WSL + Ubuntu (restart ពេលគេឲ្យ បន្ទាប់មកបើក **Ubuntu** ម្តងដើម្បីបង្កើត
   username/password Linux)៖
   ```powershell
   wsl --install
   ```
3. ផ្ទៀងផ្ទាត់ជំនាន់ទី ២៖ `wsl --list --verbose` (ត្រូវបង្ហាញ `VERSION 2`፤ បើ
   បង្ហាញ 1៖ `wsl --set-version Ubuntu 2`)។ បើបរាជ័យដោយសារ virtualization,
   សូមបើក **VT-x / AMD-V** ក្នុង BIOS/UEFI ហើយព្យាយាមម្តងទៀត។

### ជំហានទី ២ — ដំឡើង Docker Desktop

1. ដំណើរការកម្មវិធីដំឡើង **Windows** ពី docker.com (ទុក **"Use WSL 2 instead
   of Hyper-V"** ឲ្យធីក), restart បើគេឲ្យ, ដំណើរការ Docker Desktop។
2. រង់ចាំរូបត្រីបាឡែន (system tray) ឈប់វិល បន្ទាប់មកផ្ទៀងផ្ទាត់៖
   ```powershell
   docker --version
   docker compose version
   ```
3. Docker Desktop → ⚙ Settings → **Resources** → **Memory ≥ 8 GB**,
   CPUs ≥ 4 → **Apply & restart**។

### ជំហានទី ៣ — ដំឡើង Git for Windows

ដំឡើងពី git-scm.com (ទុកលំនាំដើម) បន្ទាប់មកក្នុង PowerShell **ថ្មី**៖
`git --version`។

### ជំហានទី ៤ — Clone repository

```powershell
cd $HOME
git clone <YOUR-REPO-URL> room_manager_v2
cd room_manager_v2
```

> ⚠️ Clone ទៅផ្លូវ **ខ្លី គ្មានដកឃ្លា** ដូចជា `C:\Users\<you>\room_manager_v2`
> (ផ្លូវវែង + ដកឃ្លាបង្កបញ្ហាចម្លែកៗ)។

### ជំហានទី ៥ — (បានណែនាំ) កំណត់ secrets

```powershell
Copy-Item .env.example .env
$env:MINIO_ROOT_PASSWORD="change-me-minio-32chars-min"
$env:GRAFANA_ADMIN_PASSWORD="change-me-grafana"
# បន្ទាប់មកដំណើរការជំហានទី ៦ ក្នុង window ដដែល
```

### ជំហានទី ៦ — Build និងដំណើរការទាំងអស់ (ពាក្យបញ្ជាតែមួយ)

```powershell
docker compose up --build -d
```

- Build លើកដំបូងត្រូវការ **១៥–៤០ នាទី**፤ លើកបន្ទាប់ ~១–២ នាទី។
- មើលវឌ្ឍនភាព៖ `docker compose ps` និង `docker compose logs -f rentmanager`
  (រង់ចាំ → migrate → seed → start ដោយស្វ័យប្រវត្តិទាំងស្រុង)។

បន្តទៅ **§15.5 ផ្ទៀងផ្ទាត់ការដំឡើង**។

---

## 15.4 ជម្រើសស្រាល៖ មានតែ app + database

ល្អសម្រាប់ការសរសេរកូដប្រចាំថ្ងៃ ឬម៉ាស៊ីនខ្សោយ៖ PostgreSQL ដំណើរការក្នុង Docker
(ឬ native) ហើយ Next.js app ដំណើរការផ្ទាល់ជាមួយ Node។ អ្នកទទួលបាន **web app
ពេញលេញជាមួយទិន្នន័យសាកល្បង** — មានតែផ្នែកបន្ថែម Java microservices/Kafka/Keycloak
ប៉ុណ្ណោះដែលអវត្តមាន។

### macOS

```bash
brew install node@22 git
git clone <YOUR-REPO-URL> room_manager_v2 && cd room_manager_v2
npm install
docker compose up -d postgres   # តែ database ប៉ុណ្ណោះ
cp .env.example .env            # ពិនិត្យ DATABASE_URL → localhost:5432
npx prisma generate
npx prisma migrate deploy
npm run db:seed                 # ទិន្នន័យសាកល្បង (idempotent)
npm run dev                     # → http://localhost:3000
```

(គ្មាន Docker សោះ? `brew install postgresql@16 && brew services start
postgresql@16` បន្ទាប់មក `createuser -s rentmanager` + `createdb -O rentmanager
rentmanager`។)

### Windows (PowerShell)

```powershell
# 1. ដំឡើង Node.js LTS ពី nodejs.org បន្ទាប់មកក្នុង window ថ្មី៖
node --version                  # រំពឹង v20.x ឬ v22.x
# 2. ដំឡើង PostgreSQL 16 (EDB installer, port 5432) បន្ទាប់មកបង្កើត role + DB៖
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE USER rentmanager WITH PASSWORD 'rentmanager' SUPERUSER;"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE rentmanager OWNER rentmanager;"
# (ជម្រើស៖ រំលង installer — `docker compose up -d postgres`)
# 3. Clone + ដំណើរការ៖
cd $HOME
git clone <YOUR-REPO-URL> room_manager_v2; cd room_manager_v2
npm install
Copy-Item .env.example .env
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev                     # → http://localhost:3000
```

បញ្ឈប់ dev server ដោយ `Ctrl+C`។ ពាក្យបញ្ជាមានប្រយោជន៍៖ `npm run lint`,
`npm run typecheck`, `npm test`, `npm run db:seed:demo` (ទិន្នន័យសាកល្បងពេញលេញ)។

---

## 15.5 ផ្ទៀងផ្ទាត់ការដំឡើង

```bash
docker compose up -d --wait     # រង់ចាំរហូតដល់ healthchecks ជោគជ័យ
curl -sf http://localhost:3000/api/health && echo " APP OK"
```

(Windows PowerShell៖ `curl.exe -sf http://localhost:3000/api/health` —
JSON `{"status":"ok",…}` មានន័យថាប្រព័ន្ធល្អ។)

| អ្វី | URL | Login (លំនាំដើម — ប្តូរមុន production!) |
|---|---|---|
| **RentManager app** | http://localhost:3000 | `root@demo.test` / `Demo1234!` |
| ឯកសារ API (Swagger) | http://localhost:8080/swagger-ui.html | — |
| Nacos | http://localhost:8848/nacos | `nacos` / `nacos` |
| Keycloak | http://localhost:7080 | `admin` / `admin` |
| Kafka UI | http://localhost:8090 | — |
| ឯកសារ MinIO | http://localhost:9001 | `rentmanager` / `rentmanager-s3-secret` |
| Grafana | http://localhost:9090 | `admin` / `admin` |

✅ **ជោគជ័យ =** ទំព័រ login បើកឡើង, `root@demo.test` ចូលបាន, ហើយ dashboard
បង្ហាញ properties សាកល្បង។

---

## 15.6 ការចូលលើកដំបូង និងជំហានបន្ទាប់

1. បើក **http://localhost:3000/login** ចូលជា `root@demo.test`
   (ពាក្យសម្ងាត់ `Demo1234!`)។ គណនីសាកល្បងផ្សេង៖ `admin@`, `pm@`,
   `accountant@`, `staff@`, `owner@`, `owner2@`, `member@demo.test` — ពាក្យសម្ងាត់ដូចគ្នា។
2. ចុះឈ្មោះ **2FA** (តម្រូវសម្រាប់ Admin+)៖ Account → Security។
3. បង្កើត **Super Admin ពិត** សម្រាប់ខ្លួនអ្នក បន្ទាប់មក **បិទ ឬប្តូរពាក្យសម្ងាត់
   គណនី `*@demo.test` ទាំងអស់** មុនប្រើ production។
4. អនុវត្តតាម **ផ្នែកទី ៨ §8.7 (ផ្លូវមាសអ្នកគ្រប់គ្រង)**៖ org/locale → properties →
   users/roles → billing → owners → Telegram → security → backups។
5. កំណត់កាលវិភាគ **បម្រុងទុករៀងរាល់យប់** (§15.8) — ធ្វើនៅថ្ងៃទីមួយ។

> ⚠️ ទិន្នន័យសាកល្បងសម្រាប់តែការបណ្តុះបណ្តាល។ កុំដំណើរការលុយពិតលើវា — ដំឡើងថ្មី
> សម្រាប់ production ហើយប្តូរ secret លំនាំដើម **ទាំងអស់** (ផ្នែកទី ៩ + Admin Guide §11)។

---

## 15.7 ពាក្យបញ្ជាប្រចាំថ្ងៃ

```bash
docker compose ps                    # ស្ថានភាព container ទាំងអស់
docker compose logs -f rentmanager   # តាមដាន app logs (Ctrl+C ដើម្បីចេញ)
docker compose logs -f gateway       # តាមដាន API gateway logs
docker compose stop                  # បញ្ឈប់ទាំងអស់ (ទិន្នន័យនៅដដែល)
docker compose start                 # ចាប់ផ្តើមម្តងទៀត
docker compose down                  # បញ្ឈប់ + លុប containers (ទិន្នន័យនៅដដែល)
docker compose down -v               # ⚠️ បញ្ឈប់ + លុបទិន្នន័យទាំងអស់ (ចាប់ផ្តើមថ្មី)
```

(ពាក្យបញ្ជាដូចគ្នាក្នុង macOS Terminal, PowerShell, Git Bash និង WSL។)

---

## 15.8 ការងារតាមកាលវិភាគ

app មាន job endpoints សម្រាប់ cron — ហៅវាតាមកាលវិភាគជាមួយ Admin session/token។
បីដែលអ្នកត្រូវកំណត់ចាប់ពីថ្ងៃទីមួយ៖

| ការងារ | Endpoint | កាលវិភាគធម្មតា |
|---|---|---|
| `billing-daily` | `POST /api/jobs/billing-daily` | ប្រចាំថ្ងៃ ~01:00 |
| `backup` | `POST /api/jobs/backup` (**រៀងរាល់យប់ — កុំរំលង!**) | ប្រចាំថ្ងៃ ~02:00 |
| `rent-alerts` | `POST /api/jobs/rent-alerts` | ប្រចាំថ្ងៃ ~06:00 |

បូកនឹង `invoice-generation` ប្រចាំខែ (ថ្ងៃ billing) និង `statement-generation`
(ថ្ងៃ payout)፤ `telegram-dispatch` ប្រចាំថ្ងៃ/ម៉ោង፤ `sla-sweep`,
`attendance-sweep`, `retention` ប្រចាំថ្ងៃ។ តារាងពេញលេញ៖ Admin Guide §9។

**macOS/Linux cron** (`crontab -e` ប្រើ dedicated Admin service account)៖

```bash
0 1 * * * curl -sf -X POST http://localhost:3000/api/jobs/billing-daily -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 2 * * * curl -sf -X POST http://localhost:3000/api/jobs/backup        -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 6 * * * curl -sf -X POST http://localhost:3000/api/jobs/rent-alerts   -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
```

**Windows Task Scheduler៖** រក្សាទុក `invoke-jobs.ps1` ដែលប្រើ
`Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs/backup …`
បន្ទាប់មក Create Basic Task → Daily 02:00 → Start a program `powershell.exe` ជាមួយ
`-ExecutionPolicy Bypass -File C:\RentManager\jobs\invoke-jobs.ps1`។

---

## 15.9 ការអាប់ដេត និងការលុបចេញ

### អាប់ដេតទៅជំនាន់ថ្មី

```bash
cd ~/room_manager_v2        # Windows: cd $HOME\room_manager_v2
git pull
docker compose up --build -d
curl -sf http://localhost:3000/api/health && echo " APP OK"
```

Migrations ដំណើរការដោយស្វ័យប្រវត្តិពេល boot ហើយជា **append-only**
(មានសុវត្ថិភាពពេលអនុវត្តលើ snapshots ចាស់፤ មិនមាន rollback — restore ពី backup ជំនួស)។

### ការលុបចេញ

- បញ្ឈប់៖ `docker compose down` (ទិន្នន័យនៅដដែលក្នុង volumes፤ `down -v` លុបវា)។
- លុប Docker Desktop តាមរបៀប uninstall ធម្មតារបស់ OS፤ លុប folder repo ចោល។
- macOS៖ `rm -rf ~/room_manager_v2` (+ `~/.docker` ប្រសិនបើលុបទិន្នន័យ Docker)។

---

## 15.10 ការដោះស្រាយបញ្ហា

| បញ្ហា | ដំណោះស្រាយ |
|---|---|
| `Cannot connect to the Docker daemon` | បើក Docker Desktop ហើយរង់ចាំរូបត្រីបាឡែនឈប់វិល፤ Windows៖ Settings → General → ✅ **Use the WSL 2 based engine** |
| Build យឺតខ្លាំង / containers OOM | Docker Settings → Resources → Memory **≥ 8 GB**, CPUs ≥ 4 → Apply & restart፤ បិទ app ធ្ងន់ៗពេល build |
| `port is already allocated` | Mac៖ `lsof -i :3000` → `kill <PID>`។ Windows៖ `netstat -ano \| findstr :3000` → `taskkill /PID <pid> /F`។ ជនញឹកញាប់៖ Postgres ទីពីរ (Mac៖ `brew services stop postgresql@16`፤ Windows៖ Services → `postgresql-x64-16` → Stop) |
| WSL errors / VERSION 1 (Windows) | បើក VT-x/AMD-V ក្នុង BIOS፤ [ADMIN] `dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart` + restart፤ `wsl --update`፤ `wsl --set-version Ubuntu 2` |
| App វិល "waiting for database" | `docker compose ps` → តើ `postgres` healthy? ពិនិត្យ `docker compose logs postgres`፤ ធានា port 5432 មិនជាប់ |
| ទំព័រ login បើកតែចូលមិនបាន | អាន `docker compose logs --tail=100 rentmanager` (seed អាចបរាជ័យ)፤ ផ្ទៀងផ្ទាត់ `/api/health` ត្រឡប់ 200 |
| Apple Silicon image warning | Images ជា multi-arch — មិនចាំបាច់ធ្វើអ្វីទេ፤ ជម្រើស៖ បើក **Rosetta for x86_64 emulation** ក្នុង Docker Settings |
| `npm install` EPERM / path errors (Windows) | ផ្លាស់ repo ទៅផ្លូវខ្លី (`C:\Users\<you>\room_manager_v2`)፤ ដកវាចេញពី antivirus real-time scan |
| ថាសពេញ | `docker system df` → `docker system prune`፤ លុប `backups/*.dump` ចាស់ៗ፤ Windows៖ `wsl --shutdown` បន្ទាប់មក compact `.vhdx` របស់ Docker |
| Clock skew បំបែក sessions (WSL ក្រោយ sleep) | `wsl --shutdown` បើក Docker ម្តងទៀត |

នៅតែជាប់? ប្រមូល `docker compose ps` + `docker compose logs --tail=100
rentmanager` — វាចង្អុលបញ្ហា 90%។ បញ្ហាអ្នកប្រើប្រាស់ → **ផ្នែកទី ១០**។
