-- M08 Ledger enforcement (INTENT.md §9.2/§9.3):
--   Σ debits = Σ credits per posting (CHECK via trigger, SQLite style)
--   entry lines are single-sided (exactly one of debit/credit > 0)
--   the ledger is append-only — UPDATE/DELETE raise ABORT (reversals only)

CREATE TRIGGER ledger_tx_balanced_insert
BEFORE INSERT ON "LedgerTransaction"
WHEN NEW.totalDebit <> NEW.totalCredit OR NEW.totalDebit <= 0
BEGIN
  SELECT RAISE(ABORT, 'LedgerTransaction must balance: totalDebit = totalCredit > 0');
END;

CREATE TRIGGER ledger_entry_sides_insert
BEFORE INSERT ON "LedgerEntry"
WHEN NEW.debit < 0 OR NEW.credit < 0 OR (NEW.debit > 0 AND NEW.credit > 0) OR (NEW.debit = 0 AND NEW.credit = 0)
BEGIN
  SELECT RAISE(ABORT, 'LedgerEntry must be single-sided: exactly one of debit/credit > 0');
END;

CREATE TRIGGER ledger_tx_no_update
BEFORE UPDATE ON "LedgerTransaction"
BEGIN
  SELECT RAISE(ABORT, 'Ledger is append-only: post a reversal instead');
END;

CREATE TRIGGER ledger_tx_no_delete
BEFORE DELETE ON "LedgerTransaction"
BEGIN
  SELECT RAISE(ABORT, 'Ledger is append-only: post a reversal instead');
END;

CREATE TRIGGER ledger_entry_no_update
BEFORE UPDATE ON "LedgerEntry"
BEGIN
  SELECT RAISE(ABORT, 'Ledger is append-only: post a reversal instead');
END;

CREATE TRIGGER ledger_entry_no_delete
BEFORE DELETE ON "LedgerEntry"
BEGIN
  SELECT RAISE(ABORT, 'Ledger is append-only: post a reversal instead');
END;

CREATE TRIGGER ledger_account_no_delete
BEFORE DELETE ON "LedgerAccount"
BEGIN
  SELECT RAISE(ABORT, 'Chart of accounts is append-only');
END;
