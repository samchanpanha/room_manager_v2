/// M27 nightly backup job: consistent SQLite snapshot via `VACUUM INTO`
/// (safe on a live DB — readers/writers are untouched), pruned to keep the
/// newest N files. Restore runbook: docs/BACKUP.md.
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";

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
  const file = path.join(dir, `backup-${stamp}.db`);
  // VACUUM INTO produces a fresh, consistent snapshot — no WAL juggling.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const pruned: string[] = [];
  const backups = readdirSync(dir)
    .filter((f) => /^backup-.*\.db$/.test(f))
    .sort()
    .reverse();
  for (const stale of backups.slice(KEEP_BACKUPS)) {
    unlinkSync(path.join(dir, stale));
    pruned.push(stale);
  }
  return { file, bytes: statSync(file).size, pruned };
}
