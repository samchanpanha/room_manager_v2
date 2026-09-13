package com.rentmanager.common.event;

/**
 * Canonical topic names for all RentManager Kafka topics.
 *
 * <p>Keep in sync with {@code deploy/nacos/config/shared-common.yml}
 * and the Kafka topic-provisioning scripts.
 *
 * <p>Partition strategy: all topics use the primary aggregate ID as the key
 * so events for the same aggregate are processed in order.
 */
public final class RmTopics {

    private RmTopics() {}

    // ── Member / Identity ────────────────────────────────────────────────────
    /** Produced by: identity-service.  Events: member.created, member.status_changed */
    public static final String MEMBER_EVENTS    = "rm.member.events";

    // ── Property / Physical inventory ────────────────────────────────────────
    /** Produced by: property-service.  Events: room.status_changed, stay.checked_in/out */
    public static final String PROPERTY_EVENTS  = "rm.property.events";

    // ── Billing ──────────────────────────────────────────────────────────────
    /** Produced by: billing-service.  Events: lease.activated, lease.terminated */
    public static final String LEASE_EVENTS     = "rm.lease.events";

    /** Produced by: billing-service.  Events: invoice.issued, invoice.overdue, invoice.voided */
    public static final String INVOICE_EVENTS   = "rm.invoice.events";

    /** Produced by: billing-service.  Events: payment.confirmed, payment.refunded */
    public static final String PAYMENT_EVENTS   = "rm.payment.events";

    /** Produced by: billing-service.  Events: deposit.settled */
    public static final String DEPOSIT_EVENTS   = "rm.deposit.events";

    // ── Operations ───────────────────────────────────────────────────────────
    /** Produced by: ops-service.  Events: ticket.resolved, inspection.completed, complaint.escalated */
    public static final String OPS_EVENTS       = "rm.ops.events";

    // ── Commerce ─────────────────────────────────────────────────────────────
    /** Produced by: commerce-service.  Events: sale.completed, charge_to_room.requested */
    public static final String POS_EVENTS       = "rm.pos.events";

    // ── Owner / Staff ─────────────────────────────────────────────────────────
    /** Produced by: staff-service.  Events: statement.approved, payout.completed */
    public static final String STATEMENT_EVENTS = "rm.statement.events";

    // ── Notification (dead-letter) ───────────────────────────────────────────
    /** Dead-letter queue for failed notification dispatch. */
    public static final String NOTIFICATION_DLT = "rm.notification.dlt";
}
