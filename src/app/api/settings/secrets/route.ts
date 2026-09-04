import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { setProviderSecret, getSettings } from "@/lib/settings";
import { hasModuleAccess } from "@/lib/rbac/can";
import { z } from "zod";

const bodySchema = z.object({
  name: z.enum(["paymentCredentials", "telegramBotToken"]),
  value: z.string().min(8).max(300)
});

/// §M28 secret-typed settings (§15 v1.4b): sealed with AES-256-GCM before
/// storage, masked on read, audited without the value. M28:update (Admin+) only.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M28")) return fail(403, "FORBIDDEN", "Missing permission M28:update");
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;
  await setProviderSecret(parsed.data.name, parsed.data.value, { id: user.id, name: user.name }, ip);
  return ok({ settings: await getSettings() });
}
