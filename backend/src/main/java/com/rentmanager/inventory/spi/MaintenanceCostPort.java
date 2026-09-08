package com.rentmanager.inventory.spi;

/**
 * SPI seam to the maintenance module (INTENT.md M19), which is not yet ported.
 * When maintenance consumes a stock part, inventory posts the
 * {@code maintenance_use} movement and calls this hook so a {@code material}
 * cost line can be attached to the ticket (valued at moving average — cost flows
 * to the ticket / M20). The maintenance module registers the real bean; until
 * then {@link NoopMaintenanceCost} is active and the call is a no-op.
 */
public interface MaintenanceCostPort {

  /**
   * Attach a material cost line to a ticket for a consumed part.
   *
   * @return the ticket's human code for the audit summary, or {@code null} when
   *     the maintenance module is not active (the movement is still recorded).
   */
  String onPartConsumed(String ticketId, String stockItemId, String label,
      int amountMinor, int qtyMilli, String actorId);
}
