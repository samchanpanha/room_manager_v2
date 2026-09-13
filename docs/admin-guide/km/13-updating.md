# 13. ការអាប់ដេតប្រព័ន្ធ


## នីតិវិធីអាប់ដេត

```bash
# 1. Snapshot ជាមុន (backup job ឬ volume backup)
# 2. Pull + rebuild + restart
git pull
docker compose up --build -d
# 3. Migrations ដំណើរការដោយស្វ័យប្រវត្តិក្នុង entrypoint፤ ផ្ទៀងផ្ទាត់៖
curl -sf http://localhost:3000/api/health
docker compose ps
```

- Migrations ជា **append-only** — មានសុវត្ថិភាពពេលអនុវត្តលើ snapshots ចាស់ៗ፤
  rollbacks មិនត្រូវបានព្យាយាម (restore ពី backup បើអ្នកត្រូវត្រឡប់)។
- មើល `docker compose logs -f rentmanager` លើ boot លើកដំបូងបន្ទាប់ពី update។
- Pin image tags / commit SHAs សម្រាប់ production ដើម្បីឲ្យ updates មានចេតនា។

---
