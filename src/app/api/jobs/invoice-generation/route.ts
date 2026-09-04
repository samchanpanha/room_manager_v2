import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { getOwnerLinkForUser } from "@/lib/owners";
import { generateInvoices } from "@/lib/billing/service";

/// Monthly generation job trigger (M07:create). PROPERTY-scoped callers only
/// generate for their assigned properties; owners cannot run it.
export async function POST(_req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "create", "M07")) return fail(403, "FORBIDDEN", "Missing permission M07:create");

  let propertyFilter: string[] | undefined;
  if (!can(user, "create", "M07")) {
    const ownerLink = await getOwnerLinkForUser(user);
    if (ownerLink) return ok({ generated: 0, skipped: 0, invoices: [] });
    propertyFilter = user.propertyIds;
  }

  const summary = await generateInvoices({ id: user.id, name: user.name }, propertyFilter);
  return ok(summary);
}
