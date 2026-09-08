-- V6 — accounting ledger (INTENT.md M08).
--
-- 1. Tenant-scope the ledger transaction/entry tables (LedgerAccount is shared
--    system reference data, so it is NOT tenant-scoped — the books that carry
--    tenantId are the transactions and entries).
-- 2. Seed the fixed system chart of accounts (idempotent).

-- 1. tenant_id on the books ------------------------------------------------
DO $$
DECLARE
    t text;
    scoped text[] := ARRAY['LedgerTransaction','LedgerEntry'];
BEGIN
    FOREACH t IN ARRAY scoped LOOP
        EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS "tenantId" TEXT', t);
        EXECUTE format(
            'UPDATE %I SET "tenantId" = ''DEFAULT'' WHERE "tenantId" IS NULL', t);
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN "tenantId" SET NOT NULL', t);
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN "tenantId" SET DEFAULT ''DEFAULT''', t);
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I ("tenantId")',
            t || '_tenantId_idx', t);
    END LOOP;
END $$;

-- 2. Seed the system chart of accounts (src/lib/ledger/accounts.ts) ---------
INSERT INTO "LedgerAccount" ("id", "code", "name", "type", "isSystem", "isActive") VALUES
  ('acct_1100', '1100', 'Cash',               'ASSET',     true, true),
  ('acct_1200', '1200', 'Bank',               'ASSET',     true, true),
  ('acct_1300', '1300', 'Rent Receivable',    'ASSET',     true, true),
  ('acct_2100', '2100', 'Deposit Liability',  'LIABILITY', true, true),
  ('acct_2200', '2200', 'Owner Payable',      'LIABILITY', true, true),
  ('acct_2300', '2300', 'Tax Payable',        'LIABILITY', true, true),
  ('acct_3900', '3900', 'Owner Distributions','EQUITY',    true, true),
  ('acct_4000', '4000', 'Rent Revenue',       'INCOME',    true, true),
  ('acct_4100', '4100', 'Service Revenue',    'INCOME',    true, true),
  ('acct_4200', '4200', 'Utility Revenue',    'INCOME',    true, true),
  ('acct_4300', '4300', 'Late Fee Revenue',   'INCOME',    true, true),
  ('acct_4900', '4900', 'Other Revenue',      'INCOME',    true, true),
  ('acct_5000', '5000', 'Operating Expenses', 'EXPENSE',   true, true),
  ('acct_5100', '5100', 'Bank Fees',          'EXPENSE',   true, true)
ON CONFLICT ("code") DO NOTHING;
