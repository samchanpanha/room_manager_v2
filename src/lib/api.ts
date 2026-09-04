import { NextResponse } from "next/server";
import type { z } from "zod";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data as Record<string, unknown>, { status });
}

export function fail(status: number, code: string, message?: string): NextResponse {
  return NextResponse.json({ error: code, message: message ?? code }, { status });
}

/// Parse + validate a JSON request body with zod. Returns a discriminated result.
export async function parseBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S
): Promise<{ data: z.infer<S>; response?: undefined } | { data?: undefined; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { response: fail(400, "INVALID_JSON", "Request body must be valid JSON") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      response: fail(400, "VALIDATION_ERROR", `${first.path.join(".") || "body"}: ${first.message}`)
    };
  }
  return { data: parsed.data };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/// Parse + validate the query string of a Request against a zod schema
/// (mirrors parseBody). Returns parsed.data or a ready 400 response.
export function parseQuery<S extends z.ZodTypeAny>(
  req: Request,
  schema: S
): { data?: z.infer<S>; response?: NextResponse } {
  const url = new URL(req.url);
  const raw: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) if (v !== "") raw[k] = v;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]!;
    return { response: fail(400, "VALIDATION_ERROR", `${first.path.join(".")}: ${first.message}`) };
  }
  return { data: parsed.data };
}
