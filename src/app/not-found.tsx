import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-xl font-semibold">Page not found</h2>
      <p className="text-sm text-muted-foreground">The page you are looking for does not exist.</p>
      <Link className="text-sm font-medium underline underline-offset-4" href="/dashboard">
        Back to dashboard
      </Link>
    </div>
  );
}
