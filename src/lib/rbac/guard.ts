import { NextResponse } from "next/server";
import type { Action } from "./catalog";
import { can, type ResourceRef, type Subject } from "./can";
import { fail } from "@/lib/api";
import { getAuthUser, type AuthUser } from "@/lib/auth/session";

export type GuardResult = { user: AuthUser; response?: undefined } | { user?: undefined; response: NextResponse };

/// Authenticate + authorize a route handler in one step.
/// Usage: const g = await authorize("create", "M04"); if (g.response) return g.response;
export async function authorize(action: Action, module: string, resource?: ResourceRef): Promise<GuardResult> {
  const user = await getAuthUser();
  if (!user) return { response: fail(401, "UNAUTHENTICATED", "Sign in required") };
  if (resource ? !can(user, action, module, resource) : !can(user, action, module)) {
    return { response: fail(403, "FORBIDDEN", `Missing permission ${module}:${action}`) };
  }
  return { user };
}

export function toSubject(user: AuthUser): Subject {
  return { id: user.id, propertyIds: user.propertyIds, permissions: user.permissions };
}
