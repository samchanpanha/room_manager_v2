package com.rentmanager.inventory.pos.service;

import com.rentmanager.billing.BillingQueryApi;
import com.rentmanager.inventory.pos.domain.PosProduct;
import com.rentmanager.inventory.pos.domain.PosRepositories;
import com.rentmanager.inventory.pos.domain.PosSale;
import com.rentmanager.inventory.pos.domain.PosSaleItem;
import com.rentmanager.inventory.pos.domain.PosSession;
import com.rentmanager.inventory.pos.dto.PosDtos.SaleLine;
import com.rentmanager.inventory.service.StockService;
import com.rentmanager.inventory.spi.PosLedgerPort;
import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.kernel.numbering.NumberingService;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * M14 POS use-cases — published API of the inventory POS sub-package. Ports
 * {@code src/lib/operations/pos-service.tsx} + the {@code /api/pos/*} routes:
 * cash-drawer sessions (open/close with expected-vs-counted variance), and
 * sales that decrement stock (M15) then either settle to the drawer
 * (cash/qr/card, posted via {@link PosLedgerPort}) or "charge to room" by
 * issuing a one-time member invoice via
 * {@link BillingQueryApi#createOneTimeInvoice} (which posts 1300/4900 itself).
 *
 * <p>Deferred to their dependencies: the receipt PDF + product photo (M17
 * storage), the label-printing HTML sheet (M17/print), and the M32 stay-tab
 * room_charge target — see docs/backend-split-plan.md.
 */
@Service
public class PosService {

  private final PosRepositories.Products products;
  private final PosRepositories.Sessions sessions;
  private final PosRepositories.Sales sales;
  private final StockService stock;
  private final BillingQueryApi billing;
  private final PosLedgerPort posLedger;
  private final NumberingService numbering;
  private final AuditService audit;

  public PosService(PosRepositories.Products products, PosRepositories.Sessions sessions,
      PosRepositories.Sales sales, StockService stock, BillingQueryApi billing,
      PosLedgerPort posLedger, NumberingService numbering, AuditService audit) {
    this.products = products;
    this.sessions = sessions;
    this.sales = sales;
    this.stock = stock;
    this.billing = billing;
    this.posLedger = posLedger;
    this.numbering = numbering;
    this.audit = audit;
  }

  private static final Set<String> METHODS = Set.of("cash", "qr", "card", "room_charge");

  // ---- results ------------------------------------------------------------

  public record OpenResult(String id, int expectedCashMinor) {}

  public record CloseResult(int expectedCashMinor, int countedCashMinor, int varianceMinor,
      int sales, int cashSales) {}

  public record SaleResult(String code, String saleId, int totalMinor, int discountMinor,
      int netMinor, String invoiceCode) {}

  // ---- sessions -----------------------------------------------------------

  @Transactional
  public OpenResult openSession(AuthPrincipal user, String propertyId, int openingFloatMinor) {
    requireCreate(user, propertyId);
    if (openingFloatMinor < 0) {
      throw new ApiException(422, "INVALID_FLOAT", "openingFloatMinor must be a non-negative integer");
    }
    String tenantId = TenantContext.get();
    sessions.findFirstByPropertyIdAndStatusAndTenantId(propertyId, "open", tenantId)
        .ifPresent(open -> {
          throw new ApiException(422, "SESSION_OPEN",
              "Session " + tail(open.getId()) + " is still open — close it first");
        });
    PosSession session = new PosSession(propertyId, openingFloatMinor, user.id(), tenantId);
    sessions.save(session);
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M14").action("pos.session_opened").entityType("pos_session").entityId(session.getId())
        .summary("POS session opened with float " + money(openingFloatMinor))
        .build());
    return new OpenResult(session.getId(), session.getExpectedCashMinor());
  }

  @Transactional
  public CloseResult closeSession(AuthPrincipal user, String sessionId, int countedCashMinor,
      String note) {
    String tenantId = TenantContext.get();
    PosSession session = sessions.findByIdAndTenantId(sessionId, tenantId)
        .orElseThrow(() -> ApiException.notFound("Session not found"));
    requireUpdate(user, session.getPropertyId());
    if (!"open".equals(session.getStatus())) {
      throw new ApiException(422, "ALREADY_CLOSED", "Session already closed");
    }
    if (countedCashMinor < 0) {
      throw new ApiException(422, "INVALID_COUNT", "countedCashMinor must be a non-negative integer");
    }
    int cashNetMinor = sales.netCashForSession(sessionId, tenantId);
    int cashSales = 0;
    for (PosSale s : sales.findBySessionIdAndTenantId(sessionId, tenantId)) {
      if ("cash".equals(s.getMethod())) cashSales++;
    }
    int allSales = (int) sales.countBySessionIdAndTenantId(sessionId, tenantId);
    int expected = PosMath.expectedCashMinor(session.getOpeningFloatMinor(), cashNetMinor);
    int variance = PosMath.varianceMinor(countedCashMinor, expected);

    session.setStatus("closed");
    session.setClosedById(user.id());
    session.setClosedAt(Instant.now());
    session.setCountedCashMinor(countedCashMinor);
    session.setVarianceMinor(variance);
    session.setCloseNote(note);
    session.setExpectedCashMinor(expected);
    sessions.save(session);

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M14").action("pos.session_closed").entityType("pos_session").entityId(sessionId)
        .summary("POS session closed — " + allSales + " sale(s), expected " + money(expected)
            + ", counted " + money(countedCashMinor) + ", variance " + money(variance)
            + (note != null && !note.isBlank() ? " (" + note + ")" : ""))
        .build());
    return new CloseResult(expected, countedCashMinor, variance, allSales, cashSales);
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listSessions(AuthPrincipal user) {
    if (!Rbdc.hasModuleAccess(user, "read", "M14")) throw ApiException.forbidden("M14", "read");
    String tenantId = TenantContext.get();
    List<PosSession> rows = "GLOBAL".equals(Rbdc.widestScope(user, "read", "M14"))
        ? sessions.findTop20ByTenantIdOrderByOpenedAtDesc(tenantId)
        : user.propertyIds().isEmpty() ? List.of()
            : sessions.findByPropertyIdInAndTenantIdOrderByOpenedAtDesc(user.propertyIds(), tenantId);
    List<Map<String, Object>> out = new ArrayList<>();
    for (PosSession s : rows) {
      List<PosSale> sessSales = sales.findBySessionIdAndTenantId(s.getId(), tenantId);
      int cashTotal = sessSales.stream().filter(x -> "cash".equals(x.getMethod()))
          .mapToInt(PosSale::getTotalMinor).sum();
      Map<String, Object> m = new HashMap<>();
      m.put("id", s.getId());
      m.put("status", s.getStatus());
      m.put("propertyId", s.getPropertyId());
      m.put("openedAt", s.getOpenedAt().toString());
      m.put("closedAt", s.getClosedAt() != null ? s.getClosedAt().toString() : null);
      m.put("openingFloatMinor", s.getOpeningFloatMinor());
      m.put("expectedCashMinor", s.getExpectedCashMinor());
      m.put("countedCashMinor", s.getCountedCashMinor());
      m.put("varianceMinor", s.getVarianceMinor());
      m.put("closeNote", s.getCloseNote());
      m.put("sales", sessSales.size());
      m.put("cashTotalMinor", cashTotal);
      out.add(m);
    }
    return out;
  }

  // ---- sales --------------------------------------------------------------

  private record Computed(PosProduct product, int qtyMilli, int lineMinor) {}

  @Transactional
  public SaleResult recordSale(AuthPrincipal user, String sessionId, String method,
      List<SaleLine> lines, String memberProfileId, String stayBookingId, String ref,
      Integer discountMinorIn, String discountLabelIn) {
    String tenantId = TenantContext.get();
    PosSession session = sessions.findByIdAndTenantId(sessionId, tenantId)
        .orElseThrow(() -> ApiException.notFound("Session not found"));
    requireCreate(user, session.getPropertyId());
    if (!"open".equals(session.getStatus())) {
      throw new ApiException(422, "SESSION_CLOSED", "Session is closed — open a new one");
    }
    if (!METHODS.contains(method)) {
      throw new ApiException(422, "INVALID_METHOD", "method must be cash | qr | card | room_charge");
    }
    if (lines == null || lines.isEmpty()) {
      throw new ApiException(422, "LINES_REQUIRED", "At least one sale line is required");
    }
    if (stayBookingId != null && !stayBookingId.isBlank()) {
      // §M32 stay tabs are not ported yet — the room_charge-to-member path is.
      throw new ApiException(422, "TAB_NOT_SUPPORTED",
          "Charging a stay tab is not available yet (M32 not migrated) — charge a member instead");
    }

    List<String> productIds = lines.stream().map(SaleLine::productId).distinct().toList();
    Map<String, PosProduct> byId = new HashMap<>();
    for (PosProduct p : products.findActiveByIds(productIds)) byId.put(p.getId(), p);
    if (byId.size() != productIds.size()) {
      throw new ApiException(404, "PRODUCT_INVALID", "One or more products are missing or inactive");
    }

    int totalMinor = 0;
    List<Computed> computed = new ArrayList<>();
    for (SaleLine l : lines) {
      PosProduct product = byId.get(l.productId());
      if (l.qty() == null || l.qty() <= 0) {
        throw new ApiException(422, "INVALID_QTY", "qty must be a positive number");
      }
      int qtyMilli = (int) Math.round(l.qty() * 1000);
      int lineMinor = PosMath.lineMinor(qtyMilli, product.getPriceMinor());
      totalMinor += lineMinor;
      computed.add(new Computed(product, qtyMilli, lineMinor));
    }

    int discountMinor = discountMinorIn != null ? discountMinorIn : 0;
    if (discountMinor < 0 || discountMinor > totalMinor) {
      throw new ApiException(422, "INVALID_DISCOUNT", "Discount must be 0–" + money(totalMinor));
    }
    String discountLabel = null;
    if (discountMinor > 0) {
      discountLabel = discountLabelIn != null && !discountLabelIn.isBlank()
          ? discountLabelIn.trim().substring(0, Math.min(80, discountLabelIn.trim().length()))
          : "Discount";
    }
    int netMinor = PosMath.netMinor(totalMinor, discountMinor);

    String resolvedMember = null;
    if ("room_charge".equals(method)) {
      if (memberProfileId == null || memberProfileId.isBlank()) {
        throw new ApiException(422, "MEMBER_REQUIRED", "room_charge needs a member to charge");
      }
      resolvedMember = memberProfileId;
    }
    String saleRef = ("room_charge".equals(method) || ref == null || ref.isBlank()) ? null : ref;

    // Stock availability check before writing anything (§M14 acceptance).
    for (Computed c : computed) {
      String stockItemId = c.product().getStockItemId();
      if (stockItemId != null) {
        StockService.ItemSummary si = stock.itemSummary(stockItemId);
        if (si != null && si.qtyMilli() < c.qtyMilli()) {
          throw new ApiException(422, "INSUFFICIENT_STOCK",
              "Not enough stock for " + c.product().getName() + " (on hand "
                  + String.format("%.3f", si.qtyMilli() / 1000.0) + " " + si.unit() + ")");
        }
      }
    }

    int year = ZonedDateTime.now(ZoneOffset.UTC).getYear();
    String code = numbering.next("POSSALE", n -> "SAL-" + year + "-" + String.format("%04d", n));

    PosSale sale = new PosSale(code, session.getId(), session.getPropertyId(), method, totalMinor,
        user.id(), tenantId);
    sale.setDiscountMinor(discountMinor);
    sale.setDiscountLabel(discountLabel);
    sale.setMemberProfileId(resolvedMember);
    sale.setRef(saleRef);
    for (Computed c : computed) {
      sale.getItems().add(new PosSaleItem(c.product().getId(), c.product().getName(), c.qtyMilli(),
          c.product().getPriceMinor(), c.lineMinor(), c.product().getStockItemId(), tenantId));
    }
    sales.save(sale);

    // Decrement stock via M15 `sale` movements.
    for (Computed c : computed) {
      if (c.product().getStockItemId() != null) {
        stock.applyStockSale(c.product().getStockItemId(), c.qtyMilli(), sale.getId(), user.id());
      }
    }

    String invoiceCode = null;
    if ("room_charge".equals(method)) {
      List<BillingQueryApi.OneTimeLine> invLines = new ArrayList<>();
      for (Computed c : computed) {
        invLines.add(new BillingQueryApi.OneTimeLine(
            c.product().getName() + " × " + trimQty(c.qtyMilli()) + " (POS " + code + ")",
            c.lineMinor()));
      }
      BillingQueryApi.OneTimeInvoice inv = billing.createOneTimeInvoice(
          "BLR-POS-" + tail8(code), session.getPropertyId(), resolvedMember, invLines,
          discountMinor, user.id());
      sale.setInvoiceId(inv.id());
      sales.save(sale);
      invoiceCode = inv.code();
    } else {
      // cash/qr/card settle immediately: DR drawer / CR other revenue (M08 SPI).
      String memo = "POS " + code + " (" + method + ")"
          + (discountMinor > 0 ? " — discount " + money(discountMinor) : "");
      posLedger.onPosSaleSettled(sale.getId(), session.getPropertyId(), method, netMinor,
          discountMinor, memo, user.id());
    }

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M14").action("pos.sale").entityType("pos_sale").entityId(sale.getId())
        .summary("POS sale " + code + ": " + money(totalMinor)
            + (discountMinor > 0 ? " − " + money(discountMinor) + " = " + money(netMinor) : "")
            + " via " + method
            + (resolvedMember != null ? " charged to member " + tail(resolvedMember)
                + " (invoice " + invoiceCode + ")" : "")
            + " — " + computed.size() + " line(s)")
        .build());

    return new SaleResult(code, sale.getId(), totalMinor, discountMinor, netMinor, invoiceCode);
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listSales(AuthPrincipal user, String sessionId) {
    if (!Rbdc.hasModuleAccess(user, "read", "M14")) throw ApiException.forbidden("M14", "read");
    String tenantId = TenantContext.get();
    List<PosSale> rows;
    if (sessionId != null && !sessionId.isBlank()) {
      rows = sales.findBySessionIdAndTenantIdOrderByCreatedAtDesc(sessionId, tenantId);
    } else if ("GLOBAL".equals(Rbdc.widestScope(user, "read", "M14"))) {
      rows = sales.findTop100ByTenantIdOrderByCreatedAtDesc(tenantId);
    } else {
      rows = user.propertyIds().isEmpty() ? List.of()
          : sales.findByPropertyIdInAndTenantIdOrderByCreatedAtDesc(user.propertyIds(), tenantId);
    }
    List<Map<String, Object>> out = new ArrayList<>();
    for (PosSale s : rows) {
      Map<String, Object> m = new HashMap<>();
      m.put("id", s.getId());
      m.put("code", s.getCode());
      m.put("method", s.getMethod());
      m.put("totalMinor", s.getTotalMinor());
      m.put("discountMinor", s.getDiscountMinor());
      m.put("discountLabel", s.getDiscountLabel());
      m.put("invoiceId", s.getInvoiceId());
      m.put("receiptDocId", s.getReceiptDocId());
      m.put("createdAt", s.getCreatedAt().toString());
      List<Map<String, Object>> ls = new ArrayList<>();
      for (PosSaleItem it : s.getItems()) {
        Map<String, Object> lm = new HashMap<>();
        lm.put("name", it.getName());
        lm.put("qtyMilli", it.getQtyMilli());
        lm.put("lineMinor", it.getLineMinor());
        ls.add(lm);
      }
      m.put("lines", ls);
      out.add(m);
    }
    return out;
  }

  // ---- helpers ------------------------------------------------------------

  private void requireCreate(AuthPrincipal user, String propertyId) {
    if (!Rbdc.can(user, "create", "M14", Rbdc.ResourceRef.property(propertyId))) {
      throw new ApiException(403, "FORBIDDEN", "Missing permission M14:create for this property");
    }
  }

  private void requireUpdate(AuthPrincipal user, String propertyId) {
    if (!Rbdc.can(user, "update", "M14", Rbdc.ResourceRef.property(propertyId))) {
      throw new ApiException(403, "FORBIDDEN", "Missing permission M14:update for this property");
    }
  }

  private static String trimQty(int qtyMilli) {
    double q = qtyMilli / 1000.0;
    return q == Math.floor(q) ? String.valueOf((long) q) : String.valueOf(q);
  }

  private static String tail(String id) {
    return id.length() <= 6 ? id : id.substring(id.length() - 6);
  }

  private static String tail8(String s) {
    return s.length() <= 8 ? s : s.substring(s.length() - 8);
  }

  private static String money(int minor) {
    return String.format("%.2f", minor / 100.0);
  }
}
