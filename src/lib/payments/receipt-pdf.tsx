/// Receipt PDF (M09) — A4 payment receipt, mirrors the invoice document style.
import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const fmt = (minor: number, currency: string) =>
  `${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandBlock: { flexGrow: 1, paddingRight: 16 },
  logo: { width: 56, height: 56, objectFit: "contain", marginBottom: 4 },
  org: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  contact: { fontSize: 8, color: "#6b7280", marginBottom: 1 },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 24, marginBottom: 4 },
  muted: { color: "#6b7280" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 18 },
  cell: { flexGrow: 1, minWidth: "45%", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 8 },
  label: { fontSize: 8, color: "#6b7280", marginBottom: 2 },
  value: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4, marginBottom: 14 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#e5e7eb", padding: 8 },
  rowLast: { flexDirection: "row", padding: 8 },
  colGrow: { flexGrow: 1 },
  colRight: { width: 110, textAlign: "right" },
  total: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 10, backgroundColor: "#f9fafb" },
  totalAmount: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  footer: { marginTop: 24, fontSize: 8, color: "#6b7280" }
});

export interface ReceiptPdfData {
  orgName: string;
  orgAddress?: string;
  orgPhone?: string;
  orgLogo?: string;
  orgFooterNote?: string;
  currency: string;
  receiptCode: string;
  paymentCode: string;
  status: string;
  memberName: string;
  method: string;
  receivedAt: Date;
  amountMinor: number;
  allocations: Array<{ code: string; amountMinor: number }>;
  remainingMinor: number;
}

export function ReceiptPdf({ data }: { data: ReceiptPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.brandBlock}>
            {data.orgLogo ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={data.orgLogo} style={styles.logo} />
            ) : null}
            <Text style={styles.org}>{data.orgName}</Text>
            {data.orgAddress ? <Text style={styles.contact}>{data.orgAddress}</Text> : null}
            {data.orgPhone ? <Text style={styles.contact}>{data.orgPhone}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.title}>{data.receiptCode}</Text>
            <Text style={styles.muted}>for payment {data.paymentCode} · {data.status}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.cell}>
            <Text style={styles.label}>Received from</Text>
            <Text style={styles.value}>{data.memberName}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>Method</Text>
            <Text style={styles.value}>{data.method.replaceAll("_", " ")}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>Received on</Text>
            <Text style={styles.value}>{data.receivedAt.toISOString().slice(0, 10)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>Member credit left</Text>
            <Text style={styles.value}>{fmt(data.remainingMinor, data.currency)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, { backgroundColor: "#f9fafb" }]}>
            <Text style={styles.colGrow}>Applied to invoice</Text>
            <Text style={styles.colRight}>Amount</Text>
          </View>
          {data.allocations.map((a, i) => (
            <View key={i} style={i === data.allocations.length - 1 ? styles.rowLast : styles.row}>
              <Text style={styles.colGrow}>{a.code}</Text>
              <Text style={styles.colRight}>{fmt(a.amountMinor, data.currency)}</Text>
            </View>
          ))}
          {data.allocations.length === 0 ? (
            <View style={styles.rowLast}>
              <Text style={[styles.colGrow, { color: "#6b7280" }]}>Not allocated — held as member credit</Text>
              <Text style={styles.colRight}>{fmt(data.amountMinor, data.currency)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.total}>
          <Text style={styles.totalAmount}>Total received</Text>
          <Text style={styles.totalAmount}>{fmt(data.amountMinor, data.currency)}</Text>
        </View>

        <Text style={styles.footer}>
          {data.orgFooterNote
            ? `${data.orgFooterNote}\n\n`
            : ""}
          This receipt was generated automatically and is the proof of payment for the applications listed above.
          Corrections appear as separate refund documents — receipts are never edited.
        </Text>
      </Page>
    </Document>
  );
}
