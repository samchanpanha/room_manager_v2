/// Invoice PDF (M07 acceptance: PDF auto-generated & stored in M17).
import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface InvoicePdfData {
  code: string;
  status: string;
  orgName: string;
  orgLegalName?: string;
  orgAddress?: string;
  orgPhone?: string;
  orgEmail?: string;
  orgWebsite?: string;
  orgTaxId?: string;
  orgLogo?: string; // data URL or empty
  invoiceFooterNote?: string;
  invoiceTemplate?: string; // "classic" | "modern"
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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  brandBlock: { flex: 1, paddingRight: 16 },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  legal: { fontSize: 9, color: "#6B7280", marginBottom: 2 },
  contact: { fontSize: 8, color: "#6B7280", marginBottom: 1 },
  logo: { width: 96, height: 96, objectFit: "contain", marginBottom: 4 },
  titleBlock: { alignItems: "flex-end" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  code: { fontSize: 9, color: "#6B7280", marginBottom: 12, textAlign: "right" },
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
  payQrCaption: { marginTop: 4, fontSize: 6.5, color: "#6B7280", textAlign: "center" },
  modernBand: { backgroundColor: "#111827", borderRadius: 6, padding: 16, paddingBottom: 12, marginBottom: 14 },
  modernBrand: { fontSize: 17, fontFamily: "Helvetica-Bold", color: "#FFFFFF", marginBottom: 1 },
  modernLegal: { fontSize: 9, color: "#D1D5DB", marginBottom: 1 },
  modernContact: { fontSize: 8, color: "#9CA3AF", marginBottom: 1 },
  modernRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 },
  modernTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  modernCode: { fontSize: 8, color: "#D1D5DB", textAlign: "right" }
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

function InvoiceHeader({ data }: { data: InvoicePdfData }) {
  if (data.invoiceTemplate === "modern") {
    return (
      <View style={styles.modernBand}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.modernBrand}>{data.orgName}</Text>
            {data.orgLegalName ? <Text style={styles.modernLegal}>{data.orgLegalName}</Text> : null}
            {data.orgAddress ? <Text style={styles.modernContact}>{data.orgAddress}</Text> : null}
            {(data.orgPhone || data.orgEmail || data.orgWebsite) ? (
              <Text style={styles.modernContact}>
                {[data.orgPhone, data.orgEmail, data.orgWebsite].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
            {data.orgTaxId ? <Text style={styles.modernContact}>Tax ID: {data.orgTaxId}</Text> : null}
          </View>
          {data.orgLogo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={data.orgLogo} style={styles.logo} />
          ) : null}
        </View>
        <View style={styles.modernRow}>
          <Text style={styles.modernTitle}>Invoice</Text>
          <Text style={styles.modernCode}>
            {data.code}
            {"\n"}status: {data.status}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.headerRow}>
      <View style={styles.brandBlock}>
        {data.orgLogo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={data.orgLogo} style={styles.logo} />
        ) : null}
        <Text style={styles.brand}>{data.orgName}</Text>
        {data.orgLegalName ? <Text style={styles.legal}>{data.orgLegalName}</Text> : null}
        {data.orgAddress ? <Text style={styles.contact}>{data.orgAddress}</Text> : null}
        {data.orgPhone ? <Text style={styles.contact}>{data.orgPhone}</Text> : null}
        {data.orgEmail ? <Text style={styles.contact}>{data.orgEmail}</Text> : null}
        {data.orgWebsite ? <Text style={styles.contact}>{data.orgWebsite}</Text> : null}
        {data.orgTaxId ? <Text style={styles.contact}>Tax ID: {data.orgTaxId}</Text> : null}
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Invoice</Text>
        <Text style={styles.code}>
          {data.code}
          {"\n"}status: {data.status}
        </Text>
      </View>
    </View>
  );
}

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  return (
    <Document title={`Invoice ${data.code}`} author={data.orgName}>
      <Page size="A4" style={styles.page}>
        <InvoiceHeader data={data} />

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
          {data.invoiceFooterNote
            ? `${data.invoiceFooterNote} · ${data.orgName} · ${data.orgPhone ? `tel ${data.orgPhone} · ` : ""}invoice ${data.code}`
            : `${data.orgName} · invoice ${data.code} · total = Σ items − discount + tax · generated by RentManager`}
        </Text>
      </Page>
    </Document>
  );
}
