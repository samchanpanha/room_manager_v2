import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { clockByPin } from "@/lib/operations/attendance-service";

const schema = z.object({
  propertyId: z.string().min(1),
  pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4–8 digits"),
  action: z.enum(["in", "out"]),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional()
});

/// M23 kiosk clock (§M23 "kiosk PIN"): the PIN is the credential — no session.
/// Rate-limited like login to blunt PIN guessing.
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`kiosk:${ip}`, 20, 60_000)) {
    return fail(429, "RATE_LIMITED", "Too many attempts, wait a minute");
  }
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const result = await clockByPin(
    { propertyId: parsed.data.propertyId, pin: parsed.data.pin, action: parsed.data.action, lat: parsed.data.lat ?? null, lng: parsed.data.lng ?? null },
    ip
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 401, result.code!, result.message);
  return ok(result.data!, 201);
}
