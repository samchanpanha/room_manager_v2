import { redirect } from "next/navigation";

// In-app administrator help. The guide is a static, self-contained site
// generated from docs/admin-guide/ (see docs/admin-guide/site/build.mjs) into
// public/admin-guide/. The sidebar "Admin Guide" item points here;
// /admin-guide -> the static page.
export default function AdminGuidePage() {
  redirect("/admin-guide/index.html");
}
