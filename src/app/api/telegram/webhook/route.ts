import { ok } from "@/lib/api";
import { handleTelegramUpdate, type TelegramUpdate } from "@/lib/telegram/service";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, fail } from "@/lib/api";

/// §M21 bot webhook. Signature-first: Telegram echoes the setWebhook
/// secret_token in X-Telegram-Bot-Api-Secret-Token; a mismatched header is a
/// spoofed webhook → 401 (§M21 acceptance). Everything else answers 200 so
/// Telegram does not retry-storm a rejected update.
export async function POST(req: Request) {
  if (!rateLimit(`webhook-tg:${clientIp(req)}`, 60, 60_000)) {
    return fail(429, "RATE_LIMITED", "Too many requests");
  }
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  const update = (await req.json().catch(() => ({}))) as TelegramUpdate;
  const outcome = await handleTelegramUpdate(update, secret);
  return ok({ handled: outcome.handled }, outcome.status);
}
