/// Inspection report PDF (M18: "PDF report auto-saved to M17").
import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface InspectionPdfData {
  code: string;
  type: string;
  status: string;
  orgName: string;
  propertyName: string;
  roomLabel: string;
  memberName: string;
  leaseCode: string;
  scheduledAt: Date | null;
  completedAt: Date | null;
  overallScore: number | null;
  summaryNote: string | null;
  sections: Array<{ title: string; items: Array<{ item: string; result: string; severity?: string; note?: string }> }>;
  findings: Array<{ itemLabel: string; severity: string; note: string }>;
}

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  tagline: { fontSize: 9, color: "#6B7280", marginBottom: 14 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  code: { fontSize: 9, color: "#6B7280", marginBottom: 12 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 110, color: "#6B7280" },
  value: { fontFamily: "Helvetica-Bold", flex: 1 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB", paddingVertical: 4 },
  resultPass: { width: 60, fontSize: 9, color: "#15803D", fontFamily: "Helvetica-Bold" },
  resultFail: { width: 60, fontSize: 9, color: "#B91C1C", fontFamily: "Helvetica-Bold" },
  resultNa: { width: 60, fontSize: 9, color: "#6B7280" },
  itemCell: { flex: 1, fontSize: 9, paddingRight: 8 },
  noteCell: { flex: 1, fontSize: 8, color: "#6B7280" },
  score: { marginTop: 12, fontSize: 11, fontFamily: "Helvetica-Bold" },
  finding: { marginBottom: 6, padding: 8, backgroundColor: "#FEF2F2", borderRadius: 4 },
  findingTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#B91C1C" },
  findingNote: { fontSize: 8.5, color: "#7F1D1D", marginTop: 2 },
  footer: { position: "absolute", bottom: 24, left: 42, right: 42, textAlign: "center", fontSize: 8, color: "#9CA3AF" }
});

function fmt(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function InspectionPdf({ data }: { data: InspectionPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>{data.orgName}</Text>
        <Text style={styles.tagline}>Room condition inspection report</Text>
        <Text style={styles.title}>
          {data.type.replace("_", " ")} inspection — room {data.roomLabel}
        </Text>
        <Text style={styles.code}>
          {data.code} · {data.status}
        </Text>

        <View style={styles.row}>
          <Text style={styles.label}>Member</Text>
          <Text style={styles.value}>{data.memberName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Lease</Text>
          <Text style={styles.value}>{data.leaseCode}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Property</Text>
          <Text style={styles.value}>{data.propertyName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Scheduled</Text>
          <Text style={styles.value}>{fmt(data.scheduledAt)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Completed</Text>
          <Text style={styles.value}>{fmt(data.completedAt)}</Text>
        </View>

        {data.sections.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((it, ix) => (
              <View key={`${section.title}-${ix}`} style={styles.tableRow} wrap={false}>
                <Text style={it.result === "pass" ? styles.resultPass : it.result === "fail" ? styles.resultFail : styles.resultNa}>
                  {it.result.toUpperCase()}
                </Text>
                <Text style={styles.itemCell}>{it.item}</Text>
                <Text style={styles.noteCell}>{[it.severity ? `severity: ${it.severity}` : null, it.note].filter(Boolean).join(" — ")}</Text>
              </View>
            ))}
          </View>
        ))}

        {data.overallScore != null ? <Text style={styles.score}>Overall score: {data.overallScore}/100</Text> : null}
        {data.summaryNote ? (
          <View style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 9, color: "#374151" }}>{data.summaryNote}</Text>
          </View>
        ) : null}

        {data.findings.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Findings ({data.findings.length})</Text>
            {data.findings.map((f, ix) => (
              <View key={ix} style={styles.finding}>
                <Text style={styles.findingTitle}>
                  {f.itemLabel} — {f.severity}
                </Text>
                <Text style={styles.findingNote}>{f.note}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.footer}>
          {data.code} · auto-generated by RentManager · filed to the document registry (M17)
        </Text>
      </Page>
    </Document>
  );
}
