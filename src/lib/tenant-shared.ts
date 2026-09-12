export const RESERVED_SLUGS = new Set([
  "default",
  "api",
  "admin",
  "login",
  "register",
  "portal",
  "pay",
  "account",
  "guide",
  "root",
  "system",
  "auth",
  "settings"
]);

export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
