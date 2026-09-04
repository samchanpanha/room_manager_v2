/// Lease contract PDF (M05 acceptance: PDF generation of contract).
/// Rendered server-side with @react-pdf/renderer and auto-filed to M17.
import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface ContractData {
  code: string;
  status: string;
  memberName: string;
  memberEmail: string | null;
  memberPhone: string | null;
  memberIdNumber: string | null;
  roomLabel: string; // property / building / floor / room
  bedLabel: string | null;
  startDate: string;
  endDate: string | null;
  rentMinor: number;
  currency: string;
  billingCycleDay: number;
  prorationBasis: string;
  depositMinor: number;
  depositInstallments: number;
  noticeDays: number;
  autoRenew: boolean;
  escalationPercent: number | null;
  services: Array<{ name: string; amountMinor: number; pricingModel: string }>;
  generatedAt: string;
}

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  tagline: { fontSize: 9, color: "#6B7280", marginBottom: 14 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  code: { fontSize: 9, color: "#6B7280", marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 130, color: "#6B7280" },
  value: { fontFamily: "Helvetica-Bold", flex: 1 },
  table: { width: "100%" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB", paddingVertical: 3 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#374151" },
  td: { fontSize: 9 },
  c1: { width: "55%" },
  c2: { width: "25%", textAlign: "right" },
  c3: { width: "20%", textAlign: "right", color: "#6B7280" },
  clause: { marginBottom: 5, lineHeight: 1.45, textAlign: "justify" },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 42 },
  signature: { width: "45%" },
  signatureLine: { borderTopWidth: 1, borderTopColor: "#111827", marginBottom: 3, paddingTop: 3 },
  footer: { position: "absolute", bottom: 24, left: 42, right: 42, textAlign: "center", fontSize: 8, color: "#9CA3AF" },
  fixed: { height: 8 }
});

function money(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

export function LeaseContractPdf({ data }: { data: ContractData }) {
  const billingDesc = `Rent is payable in advance on day ${data.billingCycleDay} of each month (${data.prorationBasis === "thirty_day" ? "30-day" : "calendar"} proration basis applies to mid-month starts and ends).`;
  return (
    <Document title={`Lease ${data.code}`} author="RentManager">
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>RentManager</Text>
        <Text style={styles.tagline}>Rental &amp; co-living operations platform — generated contract</Text>
        <Text style={styles.title}>Member Occupancy Lease</Text>
        <Text style={styles.code}>{data.code} · status: {data.status} · generated {data.generatedAt}</Text>

        <Text style={styles.sectionTitle}>1. Parties</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Member</Text>
          <Text style={styles.value}>{data.memberName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Contact</Text>
          <Text style={styles.value}>
            {data.memberEmail ?? "—"}
            {data.memberPhone ? ` · ${data.memberPhone}` : ""}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>ID / passport</Text>
          <Text style={styles.value}>{data.memberIdNumber ?? "—"}</Text>
        </View>

        <Text style={styles.sectionTitle}>2. Premises</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.value}>{data.roomLabel}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Bed</Text>
          <Text style={styles.value}>{data.bedLabel ?? "Entire room"}</Text>
        </View>

        <Text style={styles.sectionTitle}>3. Term</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Start date</Text>
          <Text style={styles.value}>{data.startDate}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>End date</Text>
          <Text style={styles.value}>{data.endDate ?? "Open-ended"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Notice period</Text>
          <Text style={styles.value}>{data.noticeDays} days</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Auto-renew</Text>
          <Text style={styles.value}>{data.autoRenew ? "Yes" : "No"}</Text>
        </View>
        {data.escalationPercent !== null ? (
          <View style={styles.row}>
            <Text style={styles.label}>Annual escalation</Text>
            <Text style={styles.value}>{data.escalationPercent}% / year</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>4. Rent &amp; billing</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Monthly rent</Text>
          <Text style={styles.value}>{money(data.rentMinor, data.currency)}</Text>
        </View>
        <Text style={styles.clause}>{billingDesc}</Text>

        <Text style={styles.sectionTitle}>5. Security deposit</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Deposit total</Text>
          <Text style={styles.value}>{money(data.depositMinor, data.currency)}</Text>
        </View>
        <Text style={styles.clause}>
          Payable in {data.depositInstallments} installment(s). The deposit is held against damages and unpaid dues and is
          settled after the move-out inspection, less approved deductions.
        </Text>

        {data.services.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>6. Included services</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={[styles.th, styles.c1]}>Service</Text>
                <Text style={[styles.th, styles.c2]}>Amount</Text>
                <Text style={[styles.th, styles.c3]}>Billing</Text>
              </View>
              {data.services.map((s) => (
                <View key={s.name} style={styles.tableRow}>
                  <Text style={[styles.td, styles.c1]}>{s.name}</Text>
                  <Text style={[styles.td, styles.c2]}>{money(s.amountMinor, data.currency)}</Text>
                  <Text style={[styles.td, styles.c3]}>{s.pricingModel.replaceAll("_", " ")}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>7. General clauses</Text>
        <Text style={styles.clause}>
          The member agrees to the house rules of the property, to treat the premises and shared facilities with care, and to
          report maintenance issues promptly. Early termination by either party requires written notice within the notice
          period; the operator may terminate for cause with immediate effect in case of material breach.
        </Text>
        <Text style={styles.clause}>
          This document was generated by RentManager and is filed in the document registry. Amendments are only valid as
          signed addenda.
        </Text>

        <View style={styles.signatureRow}>
          <View style={styles.signature}>
            <View style={styles.signatureLine} />
            <Text>For the operator</Text>
          </View>
          <View style={styles.signature}>
            <View style={styles.signatureLine} />
            <Text>Member: {data.memberName}</Text>
          </View>
        </View>
        <Text style={styles.footer}>RentManager · lease {data.code} · page 1</Text>
      </Page>
    </Document>
  );
}
