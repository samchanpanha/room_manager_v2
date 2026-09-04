import { PayClient } from "./pay-client";

export const metadata = { title: "Pay your bill" };

/// Public pay-without-login page (§M13): opened by scanning a member QR
/// (poster, invoice insert). The signed token resolves server-side; no
/// credentials beyond the QR itself.
export default function PayPage() {
  return <PayClient />;
}
