-- M12: billing window on the LeaseService snapshot — set on suspend/end so
-- the engine prorates the overlap (mid-month suspend → prorated stop).
ALTER TABLE "LeaseService" ADD COLUMN "activeFrom" DATETIME;
ALTER TABLE "LeaseService" ADD COLUMN "activeThrough" DATETIME;
