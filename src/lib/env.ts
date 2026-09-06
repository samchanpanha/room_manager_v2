import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("postgresql://rentmanager:rentmanager@localhost:5432/rentmanager"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  PAYMENT_WEBHOOK_SECRET: z.string().min(8).default("dev-webhook-secret-change-me"),
  /// M21 Telegram bot: token "dev-*" routes sends to the mock (outbox +
  /// console) instead of api.telegram.org. The webhook secret is the
  /// secret_token passed to setWebhook — Telegram echoes it in
  /// X-Telegram-Bot-Api-Secret-Token on every update.
  TELEGRAM_BOT_TOKEN: z.string().min(4).default("dev-telegram-token"),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(8).default("dev-telegram-secret"),
  TELEGRAM_BOT_USERNAME: z.string().min(2).default("RentManagerBot"),
  /// Absolute base URL used inside QR payloads (scan targets must be absolute).
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  /// M27/M28: key material for AES-256-GCM secret sealing (settings secrets,
  /// TOTP shared secrets). MUST be a long random string in production.
  SETTINGS_ENC_KEY: z.string().min(16).default("dev-settings-enc-key-change-me-32b-min"),
  /// M27: signing key for the TOTP login challenge (falls back to
  /// FILE_SIGNING_SECRET when unset).
  AUTH_CHALLENGE_SECRET: z.string().min(16).optional(),
  /// M27: backup snapshot directory (nightly job, docs/BACKUP.md).
  BACKUP_DIR: z.string().min(1).optional(),
  /// M27/§15 v1.1: S3-compatible object storage — when set, the storage
  /// adapter switches from dev-disk to S3 (signed-URL flow unchanged).
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional()
});

export const env = envSchema.parse(process.env);
