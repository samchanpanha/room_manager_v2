/// M27 nightly backup job: consistent PostgreSQL snapshot via `pg_dump`
/// (custom format — safe on a live server, readers/writers never blocked),
/// pruned to keep the newest N files. Requires the `pg_dump` binary —
/// present in the Docker image; install postgresql-client to run outside
/// Docker. Restore runbook: docs/BACKUP.md.
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

export const KEEP_BACKUPS = 7;

export function backupDir(): string {
  return process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups");
}

export interface BackupResult {
  file: string;
  bytes: number;
  pruned: string[];
}

export async function backupDatabase(): Promise<BackupResult> {
  const dir = backupDir();
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `backup-${stamp}.dump`);

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — cannot back up");
  const u = new URL(url);
  if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") {
    throw new Error(`Unsupported DATABASE_URL scheme "${u.protocol}" — Postgres required`);
  }
  // Credentials go through libpq env vars, not the argv (avoids leaking the
  // password into the process list).
  await execFileAsync(
    "pg_dump",
    ["--format=custom", "--file", file],
    {
      env: {
        ...process.env,
        PGHOST: u.hostname,
        PGPORT: u.port || "5432",
        PGUSER: u.username || "postgres",
        PGPASSWORD: u.password,
        PGDATABASE: u.pathname.replace(/^\//, "")
      }
    }
  );

  const pruned: string[] = [];
  const backups = readdirSync(dir)
    .filter((f) => /^backup-.*\.dump$/.test(f))
    .sort()
    .reverse();
  for (const stale of backups.slice(KEEP_BACKUPS)) {
    unlinkSync(path.join(dir, stale));
    pruned.push(stale);
  }
  return { file, bytes: statSync(file).size, pruned };
}