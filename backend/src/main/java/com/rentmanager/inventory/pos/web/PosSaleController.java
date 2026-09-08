package com.rentmanager.inventory.pos.web;

import com.rentmanager.inventory.pos.dto.PosDtos.RecordSaleRequest;
import com.rentmanager.inventory.pos.service.PosService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.web.ApiException;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * M14 POS sales, mirroring {@code src/app/api/pos/sales/route.ts}: cash/qr/card
 * settle to the drawer, {@code room_charge} issues a one-time member invoice;
 * stock is decremented (M15). The response echoes the print hints the terminal
 * needs (receipt/label URLs), matching the Next contract — the receipt PDF and
 * label sheet themselves are served by the still-on-Next leaf routes (M17).
 */
@RestController
@RequestMapping("/api/pos/sales")
public class PosSaleController {

  private final PosService pos;
  private final CurrentUser currentUser;

  public PosSaleController(PosService pos, CurrentUser currentUser) {
    this.pos = pos;
    this.currentUser = currentUser;
  }

  @GetMapping
  public Map<String, Object> list(@RequestParam(required = false) String sessionId) {
    return Map.of("sales", pos.listSales(currentUser.require(), sessionId));
  }

  @PostMapping
  public ResponseEntity<Map<String, Object>> record(@RequestBody RecordSaleRequest body) {
    AuthPrincipal user = currentUser.require();
    if (body.sessionId() == null || body.sessionId().isBlank()) {
      throw ApiException.validation("sessionId is required");
    }
    if (body.method() == null) throw ApiException.validation("method is required");
    if (body.lines() == null || body.lines().isEmpty()) {
      throw ApiException.validation("At least one sale line is required");
    }
    PosService.SaleResult r = pos.recordSale(user, body.sessionId(), body.method(), body.lines(),
        body.memberProfileId(), body.stayBookingId(), body.ref(), body.discountMinor(),
        body.discountLabel());

    Map<String, Object> out = new HashMap<>();
    out.put("code", r.code());
    out.put("saleId", r.saleId());
    out.put("totalMinor", r.totalMinor());
    out.put("discountMinor", r.discountMinor());
    out.put("netMinor", r.netMinor());
    out.put("invoiceCode", r.invoiceCode());
    // Receipt is served by the M17-backed leaf route (still on Next during migration).
    out.put("print", Map.of("receiptUrl", "/api/pos/sales/" + r.saleId() + "/receipt"));
    return ResponseEntity.status(HttpStatus.CREATED).body(out);
  }
}
