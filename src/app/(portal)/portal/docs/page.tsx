import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireMember } from "@/lib/portal";
import { getT } from "@/lib/locale-server";
import { UploadForm } from "./upload-form";

/// §M25 documents — the member's own M17 documents + KYC upload.
export default async function PortalDocsPage() {
  const { member } = await requireMember();

  const [{ tUi }, docs, docTypes] = await Promise.all([
    getT(),
    prisma.documentRegistry.findMany({
      where: { entity: "MEMBER", entityId: member.id },
      include: { docType: true, uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.docType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } })
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">{tUi("Documents")}</h1>
        <Badge variant={member.kycCompletedAt ? "success" : "warning"}>{member.kycCompletedAt ? tUi("KYC complete") : tUi("KYC pending")}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadForm entityId={member.id} docTypes={docTypes} />
        </CardContent>
      </Card>

      {docs.length === 0 ? (
        <EmptyState title="No documents yet" hint="Upload your passport / contract to complete KYC." />
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{d.docType.name}</p>
                <p className="text-xs text-muted-foreground">
                  v{d.version} · {(d.sizeBytes / 1024).toFixed(0)} KB · {d.createdAt.toISOString().slice(0, 10)}
                  {d.expiryDate ? ` · ${tUi("expires")} ${d.expiryDate.toISOString().slice(0, 10)}` : ""}
                </p>
              </div>
              <Badge variant="secondary">{d.docType.kycRequired ? tUi("KYC") : tUi("file")}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
