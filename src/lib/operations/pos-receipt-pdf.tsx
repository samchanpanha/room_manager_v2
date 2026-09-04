/// POS sale receipt (M14: "receipt printing") — compact thermal-style slip.
import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface PosReceiptData {
  code: string;
  orgName: string;
  propertyName: string;
  method: string;
  totalMinor: number;
  memberName?: string;
  invoiceCode?: string;
  createdAt: Date;
  lines: Array<{ name: string; qtyMilli: number; unitPriceMinor: number; lineMinor: number }>;
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center" },
  sub: { fontSize: 8, color: "#6B7280", textAlign: "center", marginBottom: 10 },
  code: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  row: { flexDirection: "row", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  item: { flex: 1, paddingRight: 6 },
  qty: { width: 60, textAlign: "right", color: "#6B7280" },
  price: { width: 60, textAlign: "right" },
  line: { width: 60, textAlign: "right", fontFamily: "Helvetica-Bold" },
  totals: { marginTop: 8, alignSelf: "flex-end", width: "50%" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { fontFamily: "Helvetica-Bold", borderTopWidth: 1, borderTopColor: "#111827", paddingTop: 3, fontSize: 11 },
  meta: { marginTop: 10, fontSize: 8, color: "#6B7280" },
  footer: { marginTop: 16, textAlign: "center", fontSize: 7.5, color: "#9CA3AF" }
});

function money(minor: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);
}

export function PosReceiptPdf({ data }: { data: PosReceiptData }) {
  return (
    <Document>
      <Page size={[226, 500]} style={styles.page}>
        <Text style={styles.brand}>{data.orgName}</Text>
        <Text style={styles.sub}>{data.propertyName} · POS receipt</Text>
        <Text style={styles.code}>{data.code}</Text>
        {data.lines.map((l, ix) => (
          <View key={ix} style={styles.row} wrap={false}>
            <Text style={styles.item}>{l.name}</Text>
            <Text style={styles.qty}>{(l.qtyMilli / 1000).toFixed(l.qtyMilli % 1000 === 0 ? 0 : 3)}</Text>
            <Text style={styles.line}>{money(l.lineMinor)}</Text>
          </View>
        ))}
        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.grand}>Total</Text>
            <Text style={styles.grand}>{money(data.totalMinor)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={{ fontSize: 8, color: "#6B7280" }}>Paid via {data.method.replace("_", " ")}</Text>
            <Text style={{ fontSize: 8, color: "#6B7280" }}>{money(data.totalMinor)}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(data.createdAt)}
          {data.memberName ? `\nCharged to: ${data.memberName}` : ""}
          {data.invoiceCode ? `\nInvoice: ${data.invoiceCode}` : ""}
        </Text>
        <Text style={styles.footer}>Thank you! · auto-filed to the document registry (M17)</Text>
      </Page>
    </Document>
  );
}
