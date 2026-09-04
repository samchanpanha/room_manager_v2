/// Minimal i18n dictionary (locale: en). All UI strings for shared chrome are
/// externalized here; per-module screens adopt this pattern as they are built.
const dict: Record<string, string> = {
  "app.name": "RentManager",
  "app.tagline": "Rental & co-living operations platform",
  "auth.login.title": "Sign in to RentManager",
  "auth.login.email": "Email",
  "auth.login.password": "Password",
  "auth.login.submit": "Sign in",
  "nav.overview": "Overview",
  "nav.portfolio": "Portfolio",
  "nav.billing": "Billing & Collections",
  "nav.finance": "Ledger & Finance",
  "nav.operations": "Operations",
  "nav.comms": "Comms & Portal",
  "nav.insights": "Insights",
  "nav.admin": "Administration"
};

export function t(key: string): string {
  return dict[key] ?? key;
}
