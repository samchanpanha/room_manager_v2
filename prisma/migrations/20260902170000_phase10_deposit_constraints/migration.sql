-- M10: deposit settlement movements are append-only (§9.3 style — the
-- liability is released by posting deductions/refunds, never by editing them).

CREATE TRIGGER deposit_tx_no_update
BEFORE UPDATE ON "DepositTransaction"
BEGIN
  SELECT RAISE(ABORT, 'Deposit movements are append-only');
END;

CREATE TRIGGER deposit_tx_no_delete
BEFORE DELETE ON "DepositTransaction"
BEGIN
  SELECT RAISE(ABORT, 'Deposit movements are append-only');
END;
