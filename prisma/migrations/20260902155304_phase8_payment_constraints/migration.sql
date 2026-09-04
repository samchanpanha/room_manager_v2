-- M09: payments & their allocations are append-only (§9.3 no DELETE on
-- payments). Status updates are legitimate (machine transitions) and stay
-- allowed; rows can never be removed.

CREATE TRIGGER payment_no_delete
BEFORE DELETE ON "Payment"
BEGIN
  SELECT RAISE(ABORT, 'Payments are append-only: refund or fail instead');
END;

CREATE TRIGGER payment_allocation_no_delete
BEFORE DELETE ON "PaymentAllocation"
BEGIN
  SELECT RAISE(ABORT, 'Payment allocations are append-only');
END;

CREATE TRIGGER payment_allocation_no_update
BEFORE UPDATE ON "PaymentAllocation"
BEGIN
  SELECT RAISE(ABORT, 'Payment allocations are immutable');
END;
