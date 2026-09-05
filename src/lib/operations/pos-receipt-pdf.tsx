/// POS sale receipt (M14: "receipt printing") — compact thermal-style slip.
import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface PosReceiptData {
  code: string;
  orgName: string;
  orgAddress?: string;
  orgPhone?: string;
  orgTaxId?: string;
  orgLogo?: string;
  orgFooterNote?: string;
  printerWidthMm?: number; // 58 | 80 — drives slip width
  propertyName: string;
  method: string;
  totalMinor: number;
  memberName?: string;
  invoiceCode?: string;
  barcode?: string; // EAN-13 for the first line, printed as barcode
  currency: string;
  createdAt: Date;
  lines: Array<{ name: string; qtyMilli: number; unitPriceMinor: number; lineMinor: number }>;
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center" },
  logo: { width: 56, height: 56, objectFit: "contain", alignSelf: "center", marginBottom: 4 },
  sub: { fontSize: 8, color: "#6B7280", textAlign: "center", marginBottom: 2 },
  contact: { fontSize: 7, color: "#6B7280", textAlign: "center", marginBottom: 1 },
  code: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  row: { flexDirection: "row", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  item: { flex: 1, paddingRight: 6 },
  qty: { width: 60, textAlign: "right", color: "#6B7280" },
  price: { width: 60, textAlign: "right" },
  line: { width: 60, textAlign: "right", fontFamily: "Helvetica-Bold" },
  totals: { marginTop: 8, alignSelf: "flex-end", width: "50%" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { fontFamily: "Helvetica-Bold", borderTopWidth: 1, borderTopColor: "#111827", paddingTop: 3, fontSize: 11 },
  barcodeWrap: { alignItems: "center", marginTop: 8 },
  barcode: { width: 170, height: 40 },
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

export function PosReceiptPdf({ data, copies = 1 }: { data: PosReceiptData; copies?: number }) {
  const n = Math.max(1, Math.min(12, Math.round(copies)));
  return (
    <Document>
      {Array.from({ length: n }, (_, i) => (
        <PosReceiptPage key={i} data={data} />
      ))}
    </Document>
  );
}

function PosReceiptPage({ data }: { data: PosReceiptData }) {
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
        <Text style={styles.sub}>{data.propertyName} · POS receipt</Text>
        <Text style={styles.code}>{data.code}</Text>
        {data.lines.map((l, ix) => (
          <View key={ix} style={styles.row} wrap={false}>
            <Text style={styles.item}>{l.name}</Text>
            <Text style={styles.qty}>{(l.qtyMilli / 1000).toFixed(l.qtyMilli % 1000 === 0 ? 0 : 3)}</Text>
            <Text style={styles.line}>{money(l.lineMinor, data.currency)}</Text>
          </View>
        ))}
        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.grand}>Total</Text>
            <Text style={styles.grand}>{money(data.totalMinor, data.currency)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={{ fontSize: 8, color: "#6B7280" }}>Paid via {data.method.replace("_", " ")}</Text>
            <Text style={{ fontSize: 8, color: "#6B7280" }}>{money(data.totalMinor, data.currency)}</Text>
          </View>
        </View>
        {data.barcode ? <Ean13Code dataUrl={data.barcode} /> : null}
        <Text style={styles.meta}>
          {new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(data.createdAt)}
          {data.memberName ? `\nCharged to: ${data.memberName}` : ""}
          {data.invoiceCode ? `\nInvoice: ${data.invoiceCode}` : ""}
        </Text>
        <Text style={styles.footer}>{data.orgFooterNote ?? `Thank you!`}</Text>
      </Page>
  );
}

function Ean13Code({ dataUrl }: { dataUrl: string }) {
  return (
    <View style={styles.barcodeWrap}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={dataUrl} style={styles.barcode} />
    </View>
  );
}
