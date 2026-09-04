import { Loginform } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
            R
          </div>
          <h1 className="text-xl font-semibold">RentManager</h1>
          <p className="mt-1 text-sm text-muted-foreground">Rental &amp; co-living operations platform</p>
        </div>
        <Loginform />
        <div className="mt-4 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Demo accounts (seeded, password Demo1234!)</p>
          <p className="mt-1">root@demo.test · admin@demo.test · pm@demo.test</p>
          <p>accountant@demo.test · staff@demo.test · owner@demo.test</p>
        </div>
      </div>
    </div>
  );
}
