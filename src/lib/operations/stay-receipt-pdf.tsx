/// M32 stay checkout receipt — thermal-style slip mirroring the POS receipt
/// (§M14 "receipt printing") but scoped to the stay lifecycle: room, module,
/// interval, rent + F&B totals, deposit applied, payment.
import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface StayReceiptLine {
  name: string;
  amountMinor: number;
}

export interface StayReceiptData {
  code: string;
  orgName: string;
  orgAddress?: string;
  orgPhone?: string;
  orgTaxId?: string;
  orgLogo?: string;
  orgFooterNote?: string;
  printerWidthMm?: number;
  propertyName: string;
  roomNumber: string;
  moduleName: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  durationLabel: string;
  bucketLabel: string;
  rentMinor: number;
  lines: StayReceiptLine[];
  subtotalMinor: number;
  depositAppliedMinor: number;
  totalMinor: number;
  paidMinor: number;
  payMethod: string;
  invoiceCode?: string;
  currency: string;
  createdAt: Date;
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center" },
  logo: { width: 56, height: 56, objectFit: "contain", alignSelf: "center", marginBottom: 4 },
  sub: { fontSize: 8, color: "#6B7280", textAlign: "center", marginBottom: 2 },
  contact: { fontSize: 7, color: "#6B7280", textAlign: "center", marginBottom: 1 },
  code: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  label: { flex: 1, paddingRight: 6 },
  value: { width: 80, textAlign: "right" },
  totals: { marginTop: 8, alignSelf: "flex-end", width: "50%" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { fontFamily: "Helvetica-Bold", borderTopWidth: 1, borderTopColor: "#111827", paddingTop: 3, fontSize: 11 },
  muted: { fontSize: 8, color: "#6B7280" },
  meta: { marginTop: 10, fontSize: 8, color: "#6B7280" },
  footer: { marginTop: 16, textAlign: "center", fontSize: 7.5, color: "#9CA3AF" }
});

function money(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

function fmtDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
  } catch {
    return String(d);
  }
}

export function StayReceiptPdf({ data, copies = 1 }: { data: StayReceiptData; copies?: number }) {
  const n = Math.max(1, Math.min(12, Math.round(copies)));
  return (
    <Document>
      {Array.from({ length: n }, (_, i) => (
        <StayReceiptPage key={i} data={data} />
      ))}
    </Document>
  );
}

function StayReceiptPage({ data }: { data: StayReceiptData }) {
  const width = data.printerWidthMm === 58 ? [164, 400] : [226, 500];
  return (
    <Page size={width as [number, number]} style={styles.page}>
      {data.orgLogo ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={data.orgLogo} style={styles.logo} />
      ) : null}
      <Text style={styles.brand}>{data.orgName}</Text>
      {data.orgAddress ? <Text style={styles.contact}>{data.orgAddress}</Text> : null}
      {data.orgPhone ? <Text style={styles.contact}>{data.orgPhone}</Text> : null}
      {data.orgTaxId ? <Text style={styles.contact}>Tax ID: {data.orgTaxId}</Text> : null}
      <Text style={styles.sub}>{data.propertyName} · Stay checkout receipt</Text>
      <Text style={styles.code}>{data.code}</Text>

      <View style={styles.row}><Text style={styles.label}>Guest</Text><Text style={styles.value}>{data.guestName}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Room</Text><Text style={styles.value}>{data.roomNumber}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Module</Text><Text style={styles.value}>{data.moduleName}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Check-in → Out</Text><Text style={styles.value}>{fmtDate(data.checkIn)} → {fmtDate(data.checkOut)}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Duration</Text><Text style={styles.value}>{data.durationLabel}</Text></View>
      <View style={styles.row}><Text style={styles.label}>Priced by</Text><Text style={styles.value}>{data.bucketLabel}</Text></View>

      <View style={styles.totals}>
        <View style={styles.totalsRow}>
          <Text style={{ fontSize: 8 }}>Rent ({data.durationLabel})</Text>
          <Text style={{ fontSize: 8 }}>{money(data.rentMinor, data.currency)}</Text>
        </View>
        {data.lines.length > 0 ? data.lines.map((l, i) => (
          <View key={i} style={styles.totalsRow}>
            <Text style={styles.muted}>{l.name}</Text>
            <Text style={styles.muted}>{money(l.amountMinor, data.currency)}</Text>
          </View>
        )) : null}
        {data.subtotalMinor > data.rentMinor ? (
          <View style={styles.totalsRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text style={styles.muted}>{money(data.subtotalMinor, data.currency)}</Text>
          </View>
        ) : null}
        <View style={styles.totalsRow}>
          <Text style={styles.grand}>Total</Text>
          <Text style={styles.grand}>{money(data.totalMinor, data.currency)}</Text>
        </View>
        {data.depositAppliedMinor > 0 ? (
          <View style={styles.totalsRow}>
            <Text style={styles.muted}>Deposit applied</Text>
            <Text style={styles.muted}>−{money(data.depositAppliedMinor, data.currency)}</Text>
          </View>
        ) : null}
        <View style={styles.totalsRow}>
          <Text style={styles.grand}>Paid via {data.payMethod.replace("_", " ")}</Text>
          <Text style={styles.grand}>{money(data.paidMinor, data.currency)}</Text>
        </View>
      </View>

      <Text style={styles.meta}>
        {new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(data.createdAt)}
        {data.invoiceCode ? `\nInvoice: ${data.invoiceCode}` : ""}
      </Text>
      <Text style={styles.footer}>{data.orgFooterNote ?? "Thank you!"}</Text>
    </Page>
  );
}
