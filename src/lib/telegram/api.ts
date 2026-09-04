/// M21 Telegram Bot — Bot API client. A token starting with "dev-" routes
/// every send to the MOCK (TelegramOutbox status "mocked" + console line) so
/// the full pipeline is exercisable without a real bot; a real token POSTs to
/// api.telegram.org and records sent/failed. Every attempt lands in the
/// outbox — that table is the acceptance evidence (§M21 "member gets receipt
/// message").
import { prisma } from "@/lib/db";
import { getProviderSecret } from "@/lib/settings";

export type OutboxStatus = "sent" | "mocked" | "failed";

export async function sendTelegramMessage(chatId: string, text: string, template: string): Promise<{ status: OutboxStatus; error?: string }> {
  let status: OutboxStatus = "mocked";
  let error: string | undefined;

  const token = await getProviderSecret("telegramBotToken");
  if (!token || token.startsWith("dev-")) {
    console.log(`[telegram:mock] chat ${chatId} (${template}): ${text.replace(/\n/g, " ⏎ ").slice(0, 160)}`);
  } else {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text })
      });
      if (res.ok) {
        status = "sent";
      } else {
        status = "failed";
        error = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
      }
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
    }
  }

  await prisma.telegramOutbox.create({ data: { chatId, template, body: text, status, error: error ?? null } });
  return { status, error };
}

export const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;
