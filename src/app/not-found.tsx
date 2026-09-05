import Link from "next/link";
import { Tx } from "@/components/i18n-text";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-xl font-semibold"><Tx>Page not found</Tx></h2>
      <p className="text-sm text-muted-foreground"><Tx>The page you are looking for does not exist.</Tx></p>
      <Link className="text-sm font-medium underline underline-offset-4" href="/dashboard">
        <Tx>Back to dashboard</Tx>
      </Link>
    </div>
  );
}
