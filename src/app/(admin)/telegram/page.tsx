import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/rbac/can";
import { redirect } from "next/navigation";
import { parsePrefs } from "@/lib/telegram/service";
import { TelegramActions } from "./telegram-actions";

export const dynamic = "force-dynamic";

const PRINCIPAL_BADGE: Record<string, "success" | "info" | "warning"> = { member: "success", owner: "info", user: "warning" };

async function principalName(link: { principalType: string; memberProfileId: string | null; ownerProfileId: string | null; userId: string | null }) {
  if (link.memberProfileId) {
    const m = await prisma.memberProfile.findUnique({ where: { id: link.memberProfileId }, include: { party: true } });
    return `${m?.party.name ?? "member"} (member)`;
  }
  if (link.ownerProfileId) {
    const o = await prisma.ownerProfile.findUnique({ where: { id: link.ownerProfileId }, include: { party: true } });
    return `${o?.party.name ?? "owner"} (owner)`;
  }
  if (link.userId) {
    const u = await prisma.user.findUnique({ where: { id: link.userId } });
    return `${u?.name ?? "staff"} (staff)`;
  }
  return "—";
}

/// M21 admin console — linked chats, the delivery outbox, staff-chat binding
/// and the dispatch/digest job triggers. Gated to M21 readers (Admin+).
export default async function TelegramPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "read", "M21")) redirect("/dashboard");

  const [links, outbox, staff] = await Promise.all([
    prisma.telegramLink.findMany({ where: { unlinkedAt: null }, orderBy: { linkedAt: "desc" } }),
    prisma.telegramOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.user.findMany({ where: { status: "active", roles: { some: { role: { key: { in: ["STAFF", "PROPERTY_MANAGER", "ADMIN"] } } } } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
  ]);
  const names = await Promise.all(links.map(principalName));

  return (
    <div className="space-y-6">
      <PageHeader title="Telegram Bot" description="M21 — linked chats, notification outbox, staff-chat binding and the event dispatcher" />

      <TelegramActions staff={staff} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked chats ({links.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chats linked yet — members/owners link from their portals, staff chats are bound here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Chat</th>
                    <th className="py-2 pr-3">Principal</th>
                    <th className="py-2 pr-3">Linked</th>
                    <th className="py-2 pr-3">Toggles off</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l, i) => {
                    const prefs = parsePrefs(l.prefs);
                    const off = Object.entries(prefs)
                      .filter(([, v]) => v === false)
                      .map(([k]) => k);
                    return (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">{l.displayName ? `${l.displayName} · ` : ""}{l.chatId}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={PRINCIPAL_BADGE[l.principalType] ?? "secondary"}>{names[i]}</Badge>
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{l.linkedAt.toISOString().slice(0, 10)}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{off.length === 0 ? "all on" : off.join(", ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outbox (last 20)</CardTitle>
        </CardHeader>
        <CardContent>
          {outbox.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing sent yet — the dispatcher and commands record every attempt here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Template</th>
                    <th className="py-2 pr-3">Chat</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Body</th>
                  </tr>
                </thead>
                <tbody>
                  {outbox.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{o.createdAt.toISOString().slice(5, 16).replace("T", " ")}</td>
                      <td className="py-2 pr-3 text-xs">{o.template}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{o.chatId}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={o.status === "failed" ? "destructive" : o.status === "sent" ? "success" : "secondary"}>{o.status}</Badge>
                      </td>
                      <td className="max-w-md truncate py-2 pr-3 text-xs text-muted-foreground">{o.body}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
