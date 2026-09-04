/// Invoice PDF (M07 acceptance: PDF auto-generated & stored in M17).
import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface InvoicePdfData {
  code: string;
  status: string;
  orgName: string;
  currency: string;
  memberName: string;
  memberEmail: string | null;
  propertyName: string;
  periodStart: Date;
  periodEnd: Date;
  issuedAt: Date;
  dueDate: Date;
  items: Array<{ kind: string; name: string; qty: number; unitMinor: number; amountMinor: number }>;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountDueMinor: number;
  /** M13: member pay QR (data URL) printed on the invoice for scan-to-pay. */
  payQrDataUrl?: string;
}

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  tagline: { fontSize: 9, color: "#6B7280", marginBottom: 14 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  code: { fontSize: 9, color: "#6B7280", marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 110, color: "#6B7280" },
  value: { fontFamily: "Helvetica-Bold", flex: 1 },
  table: { width: "100%" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB", paddingVertical: 4 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#374151" },
  td: { fontSize: 9 },
  c1: { width: "58%" },
  c2: { width: "10%", textAlign: "right" },
  c3: { width: "16%", textAlign: "right" },
  c4: { width: "16%", textAlign: "right" },
  totals: { marginTop: 10, alignSelf: "flex-end", width: "45%" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsLabel: { color: "#6B7280", fontSize: 9 },
  totalsValue: { fontSize: 9 },
  grand: { fontFamily: "Helvetica-Bold", borderTopWidth: 1, borderTopColor: "#111827", marginTop: 3, paddingTop: 4, fontSize: 11 },
  due: { color: "#B91C1C", fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 24, left: 42, right: 42, textAlign: "center", fontSize: 8, color: "#9CA3AF" },
  payQrWrap: { position: "absolute", bottom: 48, right: 42, alignItems: "center", width: 110 },
  payQr: { width: 84, height: 84 },
  payQrCaption: { marginTop: 4, fontSize: 6.5, color: "#6B7280", textAlign: "center" }
});

function money(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  return (
    <Document title={`Invoice ${data.code}`} author="RentManager">
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>{data.orgName}</Text>
        <Text style={styles.tagline}>Rental &amp; co-living operations — billing document</Text>
        <Text style={styles.title}>Invoice</Text>
        <Text style={styles.code}>
          {data.code} · status: {data.status}
        </Text>

        <View style={styles.row}>
          <Text style={styles.label}>Billed to</Text>
          <Text style={styles.value}>
            {data.memberName}
            {data.memberEmail ? ` (${data.memberEmail})` : ""}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Property</Text>
          <Text style={styles.value}>{data.propertyName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Billing period</Text>
          <Text style={styles.value}>
            {fmt(data.periodStart)} – {fmt(new Date(data.periodEnd.getTime() - 86_400_000))}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Issued / due</Text>
          <Text style={styles.value}>
            {fmt(data.issuedAt)} / {fmt(data.dueDate)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Line items</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.th, styles.c1]}>Description</Text>
            <Text style={[styles.th, styles.c2]}>Qty</Text>
            <Text style={[styles.th, styles.c3]}>Unit</Text>
            <Text style={[styles.th, styles.c4]}>Amount</Text>
          </View>
          {data.items.map((i) => (
            <View key={i.name} style={styles.tableRow}>
              <Text style={[styles.td, styles.c1]}>{i.name}</Text>
              <Text style={[styles.td, styles.c2]}>{i.qty}</Text>
              <Text style={[styles.td, styles.c3]}>{money(i.unitMinor, data.currency)}</Text>
              <Text style={[styles.td, styles.c4]}>{money(i.amountMinor, data.currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{money(data.subtotalMinor, data.currency)}</Text>
          </View>
          {data.discountMinor > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={styles.totalsValue}>−{money(data.discountMinor, data.currency)}</Text>
            </View>
          ) : null}
          {data.taxMinor > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>{money(data.taxMinor, data.currency)}</Text>
            </View>
          ) : null}
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, styles.grand]}>Total</Text>
            <Text style={[styles.totalsValue, styles.grand]}>{money(data.totalMinor, data.currency)}</Text>
          </View>
          {data.amountDueMinor !== data.totalMinor ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Amount due</Text>
              <Text style={[styles.totalsValue, styles.due]}>{money(data.amountDueMinor, data.currency)}</Text>
            </View>
          ) : null}
        </View>

        {data.payQrDataUrl && data.amountDueMinor > 0 ? (
          <View style={styles.payQrWrap} fixed>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={data.payQrDataUrl} style={styles.payQr} />
            <Text style={styles.payQrCaption}>Scan to pay {money(data.amountDueMinor, data.currency)} — no login needed (M13)</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          {data.orgName} · invoice {data.code} · total = Σ items − discount + tax · generated by RentManager
        </Text>
      </Page>
    </Document>
  );
}
