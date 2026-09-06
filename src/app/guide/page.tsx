import { redirect } from "next/navigation";

// In-app help. The guide is a static, self-contained site generated from
// docs/manual/ (see docs/manual/site/build.mjs) into public/guide/. The
// sidebar "Help & Guide" item points here; /guide -> the static page.
export default function GuidePage() {
  redirect("/guide/index.html");
}
