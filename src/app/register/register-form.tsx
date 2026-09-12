"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Tx } from "@/components/i18n-text";
import { sanitizeSlug } from "@/lib/tenant-shared";

export function RegisterForm() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [initialPropertyName, setInitialPropertyName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Auto-suggest slug when company name changes if user hasn't manually edited slug
  const handleCompanyChange = (val: string) => {
    setCompanyName(val);
    if (!slugTouched) {
      setSlug(sanitizeSlug(val));
    }
  };

  // Debounced slug check
  useEffect(() => {
    const clean = sanitizeSlug(slug);
    if (!clean || clean.length < 2) {
      setSlugStatus("idle");
      return;
    }

    setSlugStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/register?slug=${encodeURIComponent(clean)}`);
        if (res.ok) {
          const data = (await res.json()) as { available?: boolean };
          setSlugStatus(data.available ? "available" : "taken");
        } else {
          setSlugStatus("idle");
        }
      } catch {
        setSlugStatus("idle");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (slugStatus === "taken") {
      setError("Please choose a different workspace slug");
      return;
    }

    setBusy(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          slug: sanitizeSlug(slug),
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          password,
          initialPropertyName: initialPropertyName.trim() || undefined
        })
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "Registration failed. Please check your information.");
        return;
      }

      // Successful registration & auto-login -> redirect to dashboard
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-6 sm:p-8 shadow-sm">
      {/* Workspace Section */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Tx>1. Organization & Workspace</Tx>
          </h2>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="companyName">
            <Tx>Company / Landlord Name</Tx> <span className="text-destructive">*</span>
          </Label>
          <Input
            id="companyName"
            placeholder="e.g. Acme Residential Living"
            value={companyName}
            onChange={(e) => handleCompanyChange(e.target.value)}
            required
            disabled={busy}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="slug">
              <Tx>Workspace Slug (URL)</Tx> <span className="text-destructive">*</span>
            </Label>
            {slugStatus === "checking" && (
              <span className="text-xs text-muted-foreground">
                <Tx>Checking availability...</Tx>
              </span>
            )}
            {slugStatus === "available" && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ✓ <Tx>Slug available</Tx>
              </span>
            )}
            {slugStatus === "taken" && (
              <span className="text-xs font-medium text-destructive">
                ✗ <Tx>Slug already in use</Tx>
              </span>
            )}
          </div>
          <div className="relative flex rounded-md shadow-sm">
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-xs text-muted-foreground">
              app/
            </span>
            <Input
              id="slug"
              className="rounded-l-none"
              placeholder="acme-living"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(sanitizeSlug(e.target.value));
              }}
              required
              disabled={busy}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="initialPropertyName">
            <Tx>First Property Name</Tx> <span className="text-xs text-muted-foreground">(Optional)</span>
          </Label>
          <Input
            id="initialPropertyName"
            placeholder="e.g. Sunview Apartments"
            value={initialPropertyName}
            onChange={(e) => setInitialPropertyName(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      {/* Admin User Section */}
      <div className="space-y-4 pt-2">
        <div className="border-b pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Tx>2. Administrator Account</Tx>
          </h2>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adminName">
            <Tx>Full Name</Tx> <span className="text-destructive">*</span>
          </Label>
          <Input
            id="adminName"
            placeholder="e.g. John Doe"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            required
            disabled={busy}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adminEmail">
            <Tx>Work Email</Tx> <span className="text-destructive">*</span>
          </Label>
          <Input
            id="adminEmail"
            type="email"
            placeholder="admin@acmeliving.com"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
            disabled={busy}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="password">
              <Tx>Password</Tx> <span className="text-destructive">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">
              <Tx>Confirm Password</Tx> <span className="text-destructive">*</span>
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={busy}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive font-medium">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full text-base font-medium py-5" disabled={busy || slugStatus === "taken"}>
        {busy ? <Tx>Creating your workspace...</Tx> : <Tx>Create Organization Workspace</Tx>}
      </Button>
    </form>
  );
}

export default RegisterForm;
