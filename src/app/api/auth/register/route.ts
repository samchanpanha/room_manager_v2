import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { registerTenant, isSlugAvailable, sanitizeSlug } from "@/lib/tenant";
import { createSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/ratelimit";
import { z } from "zod";

const registerSchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(100),
  slug: z.string().trim().min(2, "Workspace slug must be at least 2 characters").max(50),
  adminName: z.string().trim().min(2, "Admin name must be at least 2 characters").max(100),
  adminEmail: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  initialPropertyName: z.string().trim().max(100).optional()
});

/// GET /api/auth/register?slug=acme-rentals
/// Check if a workspace slug is available in real time.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return fail(400, "MISSING_SLUG", "Slug parameter is required");
  }
  const clean = sanitizeSlug(slug);
  const available = await isSlugAvailable(clean);
  return ok({ slug: clean, available });
}

/// POST /api/auth/register
/// Register a new tenant organization workspace, provision admin user, and auto-login.
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`register:${ip}`, 5, 60_000)) {
    return fail(429, "RATE_LIMITED", "Too many registration attempts, please wait a minute");
  }

  const parsed = await parseBody(req, registerSchema);
  if (parsed.response) return parsed.response;
  const data = parsed.data;

  try {
    const result = await registerTenant({
      ...data,
      ip
    });

    // Create immediate session for auto-login
    await createSession(result.user.id, {
      userAgent: req.headers.get("user-agent"),
      ip
    });

    return ok(
      {
        message: "Tenant workspace registered successfully",
        tenant: result.tenant,
        user: result.user,
        property: result.property
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return fail(400, "REGISTRATION_FAILED", message);
  }
}
