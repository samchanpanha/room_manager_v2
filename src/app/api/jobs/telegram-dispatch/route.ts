import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { dispatchTelegramEvents, sendOccupancyDigest } from "@/lib/telegram/service";

const schema = z.object({ digest: z.boolean().optional() });

/// Cron shape (wiring lands with the Phase 21 ops hardening): drains the
/// DomainEvent log through the §M21 event → template map, optionally sends
/// the daily occupancy digest to staff chats. Gate: M21:update (Admin+).
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M21")) return fail(403, "FORBIDDEN", "Missing permission M21:update");

  const summary = await dispatchTelegramEvents();
  const digest = parsed.data.digest ? await sendOccupancyDigest() : 0;
  return ok({ ...summary, digestSent: digest });
}
