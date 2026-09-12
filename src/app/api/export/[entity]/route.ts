import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { fail } from "@/lib/api";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import {
  createWorkbookBuffer,
  exportMembersData,
  exportLeasesData,
  exportInvoicesData,
  exportPaymentsData,
  exportRoomsData,
  exportFullWorkspaceWorkbook
} from "@/lib/excel/export-service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return fail(401, "UNAUTHORIZED", "Sign in required to export data");
  }

  const { entity } = await params;
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const from = fromStr ? new Date(fromStr) : undefined;
  const to = toStr ? new Date(toStr) : undefined;

  // Property scoping
  const userProperties = user.propertyIds;
  const propertyIds = propertyId
    ? [propertyId]
    : user.isSuperAdmin || user.roles.includes("ADMIN")
      ? undefined
      : userProperties;

  const tenantId = user.tenantId;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);

  let buffer: Buffer;
  let filename = `${entity}-${timestamp}.xlsx`;

  switch (entity.toLowerCase()) {
    case "members": {
      if (!hasModuleAccess(user, "read", "M02") && !can(user, "export", "M02")) {
        return fail(403, "FORBIDDEN", "Permission denied for Members export");
      }
      const data = await exportMembersData({ tenantId, propertyIds });
      buffer = createWorkbookBuffer({ Members: data });
      filename = `members-${timestamp}.xlsx`;
      break;
    }

    case "leases": {
      if (!hasModuleAccess(user, "read", "M05") && !can(user, "export", "M05")) {
        return fail(403, "FORBIDDEN", "Permission denied for Leases export");
      }
      const data = await exportLeasesData({ tenantId, propertyIds });
      buffer = createWorkbookBuffer({ Leases: data });
      filename = `leases-${timestamp}.xlsx`;
      break;
    }

    case "invoices": {
      if (!hasModuleAccess(user, "read", "M07") && !can(user, "export", "M07")) {
        return fail(403, "FORBIDDEN", "Permission denied for Invoices export");
      }
      const data = await exportInvoicesData({ tenantId, propertyIds, from, to, status });
      buffer = createWorkbookBuffer({ Invoices: data });
      filename = `invoices-${timestamp}.xlsx`;
      break;
    }

    case "payments": {
      if (!hasModuleAccess(user, "read", "M09") && !can(user, "export", "M09")) {
        return fail(403, "FORBIDDEN", "Permission denied for Payments export");
      }
      const data = await exportPaymentsData({ tenantId, propertyIds, from, to });
      buffer = createWorkbookBuffer({ Payments: data });
      filename = `payments-${timestamp}.xlsx`;
      break;
    }

    case "rooms":
    case "properties": {
      if (!hasModuleAccess(user, "read", "M04") && !can(user, "export", "M04")) {
        return fail(403, "FORBIDDEN", "Permission denied for Rooms/Properties export");
      }
      const data = await exportRoomsData({ tenantId, propertyIds });
      buffer = createWorkbookBuffer({ "Rooms & Units": data });
      filename = `rooms-${timestamp}.xlsx`;
      break;
    }

    case "all":
    case "workspace": {
      if (!user.isSuperAdmin && !user.roles.includes("ADMIN")) {
        return fail(403, "FORBIDDEN", "Full workspace export requires Admin privileges");
      }
      buffer = await exportFullWorkspaceWorkbook(tenantId, propertyIds ?? []);
      filename = `workspace-backup-${timestamp}.xlsx`;
      break;
    }

    default:
      return fail(400, "INVALID_ENTITY", `Export entity '${entity}' is not supported`);
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
