/// M26 generic report PDF (§M26 "CSV/PDF export"): title, generated-at,
/// source line (traceability) and the report table. Same document shape the
/// statement/receipt PDFs use (classic JSX runtime — import React).
import * as React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  meta: { fontSize: 8, color: "#555", marginBottom: 6 },
  source: { fontSize: 8, color: "#555", marginBottom: 12, maxWidth: 520 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 3 },
  head: { backgroundColor: "#f0f0f0", fontFamily: "Helvetica-Bold" },
  summary: { marginTop: 12, fontSize: 9 }
});

export interface ReportPdfData {
  title: string;
  source: string;
  generatedAt: string;
  period: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number | null>>;
  summaryLines: string[];
}

export function ReportPdf({ data }: { data: ReportPdfData }) {
  const widths = data.columns.length > 0 ? Math.floor(520 / data.columns.length) : 520;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.meta}>
          {data.period} · generated {data.generatedAt}
        </Text>
        <Text style={styles.source}>Source: {data.source}</Text>
        <View style={[styles.row, styles.head]}>
          {data.columns.map((c) => (
            <Text key={c.key} style={{ width: widths }}>
              {c.label}
            </Text>
          ))}
        </View>
        {data.rows.map((r, i) => (
          <View key={i} style={styles.row}>
            {data.columns.map((c) => (
              <Text key={c.key} style={{ width: widths }}>
                {r[c.key] == null ? "" : String(r[c.key])}
              </Text>
            ))}
          </View>
        ))}
        {data.summaryLines.length > 0 ? (
          <View style={styles.summary}>
            {data.summaryLines.map((l, i) => (
              <Text key={i}>{l}</Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
