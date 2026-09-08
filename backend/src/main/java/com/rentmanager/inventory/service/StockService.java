package com.rentmanager.inventory.service;

import com.rentmanager.inventory.domain.InventoryRepositories;
import com.rentmanager.inventory.domain.StockCategory;
import com.rentmanager.inventory.domain.StockItem;
import com.rentmanager.inventory.domain.StockMovement;
import com.rentmanager.inventory.domain.Stocktake;
import com.rentmanager.inventory.domain.StocktakeLine;
import com.rentmanager.inventory.domain.Supplier;
import com.rentmanager.inventory.dto.StockDtos.CountedLine;
import com.rentmanager.inventory.spi.MaintenanceCostPort;
import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.kernel.numbering.NumberingService;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import com.rentmanager.properties.PropertyAccessApi;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Stock use-cases (INTENT.md M15) — published API of the inventory module. Ports
 * {@code src/lib/operations/stock-service.ts} + the {@code /api/stock/*} routes:
 * items + categories + suppliers CRUD, and the movement engine (purchase →
 * moving-average in; consumption / maintenance_use / sale → out at moving
 * average; adjustment; transfer between items) — on-hand only ever changes via a
 * {@link StockMovement}. Stocktake posts adjustment movements for each variance;
 * the valuation report values on-hand at moving-average cost. The maintenance
 * cost line (M19) is dependency-inverted through {@link MaintenanceCostPort}.
 */
@Service
public class StockService {

  private final InventoryRepositories.Items items;
  private final InventoryRepositories.Categories categories;
  private final InventoryRepositories.Suppliers suppliers;
  private final InventoryRepositories.Movements movements;
  private final InventoryRepositories.Stocktakes stocktakes;
  private final InventoryRepositories.StocktakeLines stocktakeLines;
  private final NumberingService numbering;
  private final AuditService audit;
  private final PropertyAccessApi propertiesApi;
  private final MaintenanceCostPort maintenanceCost;

  public StockService(InventoryRepositories.Items items, InventoryRepositories.Categories categories,
      InventoryRepositories.Suppliers suppliers, InventoryRepositories.Movements movements,
      InventoryRepositories.Stocktakes stocktakes, InventoryRepositories.StocktakeLines stocktakeLines,
      NumberingService numbering, AuditService audit, PropertyAccessApi propertiesApi,
      MaintenanceCostPort maintenanceCost) {
    this.items = items;
    this.categories = categories;
    this.suppliers = suppliers;
    this.movements = movements;
    this.stocktakes = stocktakes;
    this.stocktakeLines = stocktakeLines;
    this.numbering = numbering;
    this.audit = audit;
    this.propertiesApi = propertiesApi;
    this.maintenanceCost = maintenanceCost;
  }

  // ---- results ------------------------------------------------------------

  public record ValuationRow(String id, String name, String category, String categoryId,
      String unit, String packUnit, Integer packSize, int qtyMilli, int avgCostMilli,
      int valueMinor, boolean low, int minQtyMilli) {}

  public record ValuationReport(List<ValuationRow> items, int totalValueMinor, int lowStockCount) {}

  public record MovementView(String id, String type, int qtyMilli, int qtyAfterMilli,
      int avgCostAfterMilli, int valueMilli, Integer unitCostMilli, String note, String createdAt) {}

  public record CategoryView(String id, String name, String parentId, String propertyId,
      int sortOrder, boolean active, long itemCount, long childCount) {}

  public record SupplierView(String id, String name, String phone, String email, String notes) {}

  public record StocktakeLineResult(String name, int expectedMilli, int countedMilli, int varianceMilli) {}

  public record StocktakeResult(String code, int adjustments, int valueDeltaMilli,
      List<StocktakeLineResult> lines) {}

  // ---- items --------------------------------------------------------------

  /**
   * Portfolio valuation for the {@code GET /api/stock/items} list: every property
   * the user can read (GLOBAL → all, else assigned), on-hand × moving average.
   */
  @Transactional(readOnly = true)
  public ValuationReport valuationAllScoped(AuthPrincipal user) {
    if (!Rbdc.hasModuleAccess(user, "read", "M15")) throw ApiException.forbidden("M15", "read");
    List<ValuationRow> out = new ArrayList<>();
    int total = 0;
    int low = 0;
    for (String pid : scopedPropertyIds(user)) {
      ValuationReport r = valuationInternal(pid);
      out.addAll(r.items());
      total += r.totalValueMinor();
      low += r.lowStockCount();
    }
    return new ValuationReport(out, total, low);
  }

  /** Valuation report for a property (§M15 acceptance): on-hand × moving average. */
  @Transactional(readOnly = true)
  public ValuationReport valuation(AuthPrincipal user, String propertyId) {
    requirePropertyRead(user, propertyId);
    return valuationInternal(propertyId);
  }

  private ValuationReport valuationInternal(String propertyId) {
    String tenantId = TenantContext.get();
    List<StockItem> rows = items.findByPropertyIdAndActiveTrueAndTenantIdOrderByNameAsc(propertyId, tenantId);
    List<ValuationRow> out = new ArrayList<>();
    int total = 0;
    int low = 0;
    for (StockItem i : rows) {
      int valueMinor = Math.round(StockMath.valuationMilli(i.getQtyMilli(), i.getAvgCostMilli()) / 1000f);
      boolean isLow = StockMath.isLowStock(i.getQtyMilli(), i.getMinQtyMilli());
      total += valueMinor;
      if (isLow) low++;
      out.add(new ValuationRow(i.getId(), i.getName(), i.getCategory(), i.getCategoryId(),
          i.getUnit(), i.getPackUnit(), i.getPackSize(), i.getQtyMilli(), i.getAvgCostMilli(),
          valueMinor, isLow, i.getMinQtyMilli()));
    }
    return new ValuationReport(out, total, low);
  }

  @Transactional
  public String createItem(AuthPrincipal user, String name, String categoryStr, String categoryId,
      String unit, String packUnit, Integer packSize, Integer minQtyMilli, String supplierId,
      String propertyId) {
    requirePropertyCreate(user, propertyId);
    String tenantId = TenantContext.get();
    if (name == null || name.trim().length() < 2) {
      throw new ApiException(400, "NAME_REQUIRED", "Item name (2+ chars) is required");
    }
    if (unit == null || unit.trim().isEmpty()) {
      throw new ApiException(400, "UNIT_REQUIRED", "Unit is required (pcs, kg, l, box…)");
    }
    String packErr = validatePack(unit.trim(), packUnit, packSize);
    if (packErr != null) throw new ApiException(400, "INVALID_PACK", packErr);
    if (supplierId != null && suppliers.findById(supplierId).isEmpty()) {
      throw ApiException.notFound("Supplier not found");
    }
    if (categoryId != null) {
      StockCategory cat = categories.findById(categoryId)
          .orElseThrow(() -> ApiException.notFound("Category not found"));
      if (cat.getPropertyId() != null && !cat.getPropertyId().equals(propertyId)) {
        throw new ApiException(400, "SCOPE_MISMATCH", "Category belongs to a different property");
      }
    }
    if (items.findByNameAndPropertyIdAndTenantId(name.trim(), propertyId, tenantId).isPresent()) {
      throw ApiException.duplicate("Item \"" + name.trim() + "\" already exists on this property");
    }
    String category = resolveCategorySnapshot(categoryId, categoryStr);
    StockItem item = new StockItem(name.trim(), category, unit.trim(), propertyId, tenantId);
    item.setCategoryId(categoryId);
    item.setPackUnit(emptyToNull(packUnit));
    item.setPackSize(packSize);
    item.setMinQtyMilli(minQtyMilli != null ? minQtyMilli : 0);
    item.setSupplierId(supplierId);
    items.save(item);

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M15").action("stock_item.created").entityType("stock_item").entityId(item.getId())
        .summary("Stock item \"" + item.getName() + "\" created (" + item.getCategory()
            + ", per " + item.getUnit() + ")")
        .build());
    return item.getId();
  }

  @Transactional
  public String updateItem(AuthPrincipal user, String id, String name, boolean nameSet,
      String categoryId, boolean categoryIdSet, String unit, String packUnit, boolean packUnitSet,
      Integer packSize, boolean packSizeSet, Integer minQtyMilli, String supplierId,
      boolean supplierIdSet, Boolean isActive) {
    String tenantId = TenantContext.get();
    StockItem item = items.findByIdAndTenantId(id, tenantId)
        .orElseThrow(() -> ApiException.notFound("Stock item not found"));
    if (!Rbdc.hasModuleAccess(user, "update", "M15")) throw ApiException.forbidden("M15", "update");
    requireProperty(user, "update", item.getPropertyId());

    if (nameSet && (name == null || name.trim().length() < 2 || name.trim().length() > 120)) {
      throw new ApiException(400, "NAME_REQUIRED", "Item name (2–120 chars) is required");
    }
    if (unit != null && unit.trim().isEmpty()) {
      throw new ApiException(400, "UNIT_REQUIRED", "Unit is required");
    }
    String effUnit = unit != null ? unit.trim() : item.getUnit();
    String effPackUnit = packUnitSet ? emptyToNull(packUnit) : item.getPackUnit();
    Integer effPackSize = packSizeSet ? packSize : item.getPackSize();
    String packErr = validatePack(effUnit, effPackUnit, effPackSize);
    if (packErr != null) throw new ApiException(400, "INVALID_PACK", packErr);

    if (nameSet && !name.trim().equals(item.getName())
        && items.findByNameAndPropertyIdAndTenantId(name.trim(), item.getPropertyId(), tenantId).isPresent()) {
      throw ApiException.duplicate("Item \"" + name.trim() + "\" already exists on this property");
    }
    if (categoryIdSet && categoryId != null) {
      StockCategory cat = categories.findById(categoryId)
          .orElseThrow(() -> ApiException.notFound("Category not found"));
      if (cat.getPropertyId() != null && !cat.getPropertyId().equals(item.getPropertyId())) {
        throw new ApiException(400, "SCOPE_MISMATCH", "Category belongs to a different property");
      }
    }
    if (supplierIdSet && supplierId != null && suppliers.findById(supplierId).isEmpty()) {
      throw ApiException.notFound("Supplier not found");
    }

    if (nameSet) item.setName(name.trim());
    if (unit != null) item.setUnit(effUnit);
    if (packUnitSet) item.setPackUnit(effPackUnit);
    if (packSizeSet) item.setPackSize(effPackSize);
    if (minQtyMilli != null) item.setMinQtyMilli(minQtyMilli);
    if (supplierIdSet) item.setSupplierId(supplierId);
    if (isActive != null) item.setActive(isActive);
    if (categoryIdSet) {
      item.setCategoryId(categoryId);
      item.setCategory(resolveCategorySnapshot(categoryId, item.getCategory()));
    }
    items.save(item);

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M15").action("stock_item.updated").entityType("stock_item").entityId(item.getId())
        .summary("Stock item \"" + item.getName() + "\" updated")
        .build());
    return item.getId();
  }

  public record ItemSummary(String id, String name, String unit, int qtyMilli, int avgCostMilli) {}

  public record MovementHistory(ItemSummary item, List<MovementView> movements) {}

  @Transactional(readOnly = true)
  public MovementHistory movementsFor(AuthPrincipal user, String stockItemId) {
    String tenantId = TenantContext.get();
    StockItem item = items.findByIdAndTenantId(stockItemId, tenantId)
        .orElseThrow(() -> ApiException.notFound("Stock item not found"));
    requirePropertyRead(user, item.getPropertyId());
    List<MovementView> rows = movements.historyFor(stockItemId, tenantId).stream()
        .map(m -> new MovementView(m.getId(), m.getType(), m.getQtyMilli(), m.getQtyAfterMilli(),
            m.getAvgCostAfterMilli(), m.getValueMilli(), m.getUnitCostMilli(), m.getNote(),
            m.getCreatedAt().toString()))
        .toList();
    return new MovementHistory(
        new ItemSummary(item.getId(), item.getName(), item.getUnit(), item.getQtyMilli(),
            item.getAvgCostMilli()),
        rows);
  }

  // ---- movement engine ----------------------------------------------------

  /**
   * Apply one signed movement (§M15 "movements only"): recompute on-hand +
   * moving average, persist the item, and append the movement row. Throws
   * INSUFFICIENT_STOCK when a non-purchase/adjustment outflow would go negative.
   */
  private StockMovement applyMovement(StockItem item, String type, int qtyMilli,
      Integer unitCostMilli, String actorId, MovementOpts opts) {
    if (!"purchase".equals(type) && !"adjustment".equals(type)
        && qtyMilli < 0 && item.getQtyMilli() + qtyMilli < 0) {
      throw new ApiException(422, "INSUFFICIENT_STOCK",
          "Insufficient stock: on hand " + fmt3(item.getQtyMilli()) + " " + item.getUnit());
    }
    int avgCostAfterMilli = item.getAvgCostMilli();
    int valueMilli;
    if ("purchase".equals(type) && qtyMilli > 0 && unitCostMilli != null) {
      StockMath.MovingAverage ma =
          StockMath.movingAverage(item.getQtyMilli(), item.getAvgCostMilli(), qtyMilli, unitCostMilli);
      avgCostAfterMilli = ma.avgCostAfterMilli();
      valueMilli = ma.valueDeltaMilli();
    } else {
      // Outflows/adjustment/transfer legs value the delta at the current average
      // (valueMilli is minor×1000: qty(milli)×cost(milli) is milli²).
      valueMilli = Math.toIntExact(StockMath.roundHalfUp((long) qtyMilli * item.getAvgCostMilli(), 1000));
      // avgCost is kept as the last known cost across a wipe-out (re-purchase).
    }
    int qtyAfterMilli = item.getQtyMilli() + qtyMilli;
    item.setQtyMilli(qtyAfterMilli);
    item.setAvgCostMilli(avgCostAfterMilli);
    items.save(item);

    StockMovement m = new StockMovement(item.getId(), type, qtyMilli, qtyAfterMilli,
        avgCostAfterMilli, valueMilli, item.getTenantId());
    m.setUnitCostMilli(unitCostMilli);
    m.setSaleId(opts.saleId);
    m.setTicketId(opts.ticketId);
    m.setStocktakeId(opts.stocktakeId);
    m.setPurchaseOrderId(opts.purchaseOrderId);
    m.setTargetItemId(opts.targetItemId);
    m.setNote(opts.note);
    m.setCreatedById(actorId);
    movements.save(m);
    return m;
  }

  /** Options carried onto the movement row (all optional). */
  public static final class MovementOpts {
    String saleId, ticketId, stocktakeId, purchaseOrderId, targetItemId, note;
    public MovementOpts note(String v) { this.note = v; return this; }
    public MovementOpts saleId(String v) { this.saleId = v; return this; }
    public MovementOpts ticketId(String v) { this.ticketId = v; return this; }
    public MovementOpts stocktakeId(String v) { this.stocktakeId = v; return this; }
    public MovementOpts targetItemId(String v) { this.targetItemId = v; return this; }
  }

  /**
   * POS sale leg (published for the pos module M14): decrement stock at the
   * current moving average as a {@code sale} movement tied to the POS sale row.
   */
  @Transactional
  public void applyStockSale(String stockItemId, int qtyMilli, String saleId, String actorId) {
    StockItem item = items.findByIdAndTenantId(stockItemId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Stock item not found"));
    applyMovement(item, "sale", -qtyMilli, null, actorId, new MovementOpts().saleId(saleId));
  }

  @Transactional
  public Map<String, Integer> purchase(AuthPrincipal user, String stockItemId, int qtyMilli,
      int unitCostMinor, String note, boolean inPacks) {
    StockItem item = items.findByIdAndTenantId(stockItemId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Stock item not found"));
    requirePropertyCreate(user, item.getPropertyId());
    if (qtyMilli <= 0) throw new ApiException(400, "INVALID_QTY", "qtyMilli must be a positive integer");
    if (unitCostMinor <= 0) throw new ApiException(400, "INVALID_COST", "unitCostMinor must be a positive integer");

    int qty = qtyMilli;
    int unitCostMilli = unitCostMinor * 1000;
    if (inPacks) {
      if (item.getPackUnit() == null || item.getPackSize() == null) {
        throw new ApiException(400, "INVALID_PACK", "\"" + item.getName() + "\" has no pack unit defined");
      }
      qty = qtyMilli * item.getPackSize();
      unitCostMilli = Math.round((unitCostMinor * 1000f) / item.getPackSize());
    }
    StockMovement m = applyMovement(item, "purchase", qty, unitCostMilli, user.id(),
        new MovementOpts().note(note));

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M15").action("stock.purchased").entityType("stock_item").entityId(stockItemId)
        .summary("Purchased " + fmt3(qty) + " " + item.getUnit() + " of \"" + item.getName()
            + "\" @ " + money(unitCostMinor) + " — on hand " + fmt3(m.getQtyAfterMilli())
            + ", avg cost " + fmt4(m.getAvgCostAfterMilli()))
        .build());
    return Map.of("qtyAfterMilli", m.getQtyAfterMilli(), "avgCostMilli", m.getAvgCostAfterMilli());
  }

  @Transactional
  public int consume(AuthPrincipal user, String stockItemId, int qtyMilli, String note) {
    StockItem item = items.findByIdAndTenantId(stockItemId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Stock item not found"));
    requirePropertyCreate(user, item.getPropertyId());
    if (qtyMilli <= 0) throw new ApiException(400, "INVALID_QTY", "qtyMilli must be a positive integer");
    if (note == null || note.trim().length() < 3) {
      throw new ApiException(400, "NOTE_REQUIRED", "A reason (3+ chars) is required");
    }
    StockMovement m = applyMovement(item, "consumption", -qtyMilli, null, user.id(),
        new MovementOpts().note(note.trim()));
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M15").action("stock.consumed").entityType("stock_item").entityId(stockItemId)
        .summary("Consumed " + fmt3(qtyMilli) + " " + item.getUnit() + " of \"" + item.getName()
            + "\": " + note.trim() + " — on hand " + fmt3(m.getQtyAfterMilli()))
        .build());
    return m.getQtyAfterMilli();
  }

  /**
   * Maintenance consumes a part (§M15): {@code maintenance_use} movement + a
   * {@code material} cost line on the ticket valued at moving average, attached
   * via {@link MaintenanceCostPort} (no-op until M19 is ported).
   */
  @Transactional
  public Map<String, Object> consumeForTicket(AuthPrincipal user, String ticketId,
      String stockItemId, int qtyMilli, String label) {
    StockItem item = items.findByIdAndTenantId(stockItemId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Stock item not found"));
    requirePropertyCreate(user, item.getPropertyId());
    if (qtyMilli <= 0) throw new ApiException(400, "INVALID_QTY", "qtyMilli must be a positive integer");
    int costMinor = Math.toIntExact(StockMath.roundHalfUp((long) qtyMilli * item.getAvgCostMilli(), 1_000_000));
    String defaultLabel = item.getName() + " × " + fmt3(qtyMilli) + " " + item.getUnit();

    StockMovement m = applyMovement(item, "maintenance_use", -qtyMilli, null, user.id(),
        new MovementOpts().ticketId(ticketId));
    String ticketCode = maintenanceCost.onPartConsumed(ticketId, stockItemId,
        label != null && !label.isBlank() ? label.trim() : defaultLabel, costMinor, qtyMilli, user.id());

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M15").action("stock.maintenance_used").entityType("stock_item").entityId(stockItemId)
        .summary("Ticket " + (ticketCode != null ? ticketCode : ticketId) + " consumed "
            + fmt3(qtyMilli) + " " + item.getUnit() + " of \"" + item.getName()
            + "\" @ moving avg — on hand " + fmt3(m.getQtyAfterMilli()))
        .build());
    Map<String, Object> out = new HashMap<>();
    out.put("qtyAfterMilli", m.getQtyAfterMilli());
    out.put("costMinor", costMinor);
    out.put("ticketCode", ticketCode);
    return out;
  }

  @Transactional
  public Map<String, Integer> transfer(AuthPrincipal user, String fromItemId, String toItemId,
      int qtyMilli, String note) {
    if (fromItemId.equals(toItemId)) {
      throw new ApiException(400, "SAME_ITEM", "Transfer needs two different stock items");
    }
    String tenantId = TenantContext.get();
    StockItem from = items.findByIdAndTenantId(fromItemId, tenantId)
        .orElseThrow(() -> ApiException.notFound("Stock item not found"));
    StockItem to = items.findByIdAndTenantId(toItemId, tenantId)
        .orElseThrow(() -> ApiException.notFound("Stock item not found"));
    requirePropertyCreate(user, from.getPropertyId());
    if (!from.getPropertyId().equals(to.getPropertyId())) {
      throw new ApiException(400, "OTHER_PROPERTY", "Transfers stay within one property");
    }
    if (qtyMilli <= 0) throw new ApiException(400, "INVALID_QTY", "qtyMilli must be a positive integer");

    StockMovement out = applyMovement(from, "transfer", -qtyMilli, null, user.id(),
        new MovementOpts().targetItemId(toItemId).note(note));
    int inAvg = out.getAvgCostAfterMilli() > 0 ? out.getAvgCostAfterMilli() : from.getAvgCostMilli();
    StockMovement inc = applyMovement(to, "transfer", qtyMilli, inAvg, user.id(),
        new MovementOpts().targetItemId(fromItemId).note(note));

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M15").action("stock.transferred").entityType("stock_item").entityId(fromItemId)
        .summary("Transferred " + fmt3(qtyMilli) + " " + from.getUnit() + " \"" + from.getName()
            + "\" → \"" + to.getName() + "\"")
        .build());
    return Map.of("fromQtyAfterMilli", out.getQtyAfterMilli(), "toQtyAfterMilli", inc.getQtyAfterMilli());
  }

  // ---- stocktake ----------------------------------------------------------

  @Transactional
  public StocktakeResult runStocktake(AuthPrincipal user, String propertyId, String note,
      List<CountedLine> counted) {
    requirePropertyCreate(user, propertyId);
    if (counted == null || counted.isEmpty()) {
      throw new ApiException(400, "LINES_REQUIRED", "Counted lines are required");
    }
    String tenantId = TenantContext.get();
    Map<String, StockItem> byId = new HashMap<>();
    Map<String, Integer> countedMilliById = new HashMap<>();
    Set<String> ids = new HashSet<>();
    for (CountedLine c : counted) {
      ids.add(c.stockItemId());
      if (c.counted() == null || c.counted() < 0) {
        throw new ApiException(400, "INVALID_COUNT", "counted must be a non-negative number");
      }
      countedMilliById.put(c.stockItemId(), (int) Math.round(c.counted() * 1000));
    }
    for (String id : ids) {
      StockItem item = items.findByIdAndTenantId(id, tenantId).orElse(null);
      if (item == null || !item.getPropertyId().equals(propertyId)) {
        throw new ApiException(400, "ITEM_MISMATCH",
            "One or more items are missing or belong to another property");
      }
      byId.put(id, item);
    }

    int year = ZonedDateTime.now(ZoneOffset.UTC).getYear();
    String code = numbering.next("STOCKTAKE", n -> "STK-" + year + "-" + String.format("%04d", n));
    Stocktake stocktake = new Stocktake(code, propertyId, note, user.id(), tenantId);
    stocktakes.save(stocktake);

    int valueDeltaMilli = 0;
    int adjustments = 0;
    List<StocktakeLineResult> lines = new ArrayList<>();
    for (CountedLine c : counted) {
      StockItem item = byId.get(c.stockItemId());
      int countedMilli = countedMilliById.get(c.stockItemId());
      int variance = StockMath.stocktakeVariance(item.getQtyMilli(), countedMilli);
      stocktakeLines.save(new StocktakeLine(stocktake.getId(), item.getId(), item.getQtyMilli(),
          countedMilli, variance, tenantId));
      lines.add(new StocktakeLineResult(item.getName(), item.getQtyMilli(), countedMilli, variance));
      if (variance != 0) {
        StockMovement applied = applyMovement(item, "adjustment", variance, null, user.id(),
            new MovementOpts().stocktakeId(stocktake.getId()).note("Stocktake " + code));
        valueDeltaMilli += applied.getValueMilli();
        adjustments++;
      }
    }
    stocktake.setValueDeltaMilli(valueDeltaMilli);
    stocktakes.save(stocktake);

    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M15").action("stock.stocktake").entityType("stocktake").entityId(code)
        .summary("Stocktake " + code + ": " + counted.size() + " line(s), " + adjustments
            + " adjustment(s), valuation delta " + money(Math.round(valueDeltaMilli / 1000f)))
        .build());
    return new StocktakeResult(code, adjustments, valueDeltaMilli, lines);
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listStocktakes(AuthPrincipal user) {
    List<String> scoped = scopedPropertyIds(user);
    if (scoped.isEmpty()) return List.of();
    List<Map<String, Object>> out = new ArrayList<>();
    for (Stocktake s : stocktakes.findByPropertyIdInAndTenantIdOrderByCreatedAtDesc(scoped, TenantContext.get())) {
      Map<String, Object> m = new HashMap<>();
      m.put("id", s.getId());
      m.put("code", s.getCode());
      m.put("propertyId", s.getPropertyId());
      m.put("status", s.getStatus());
      m.put("valueDeltaMilli", s.getValueDeltaMilli());
      m.put("note", s.getNote());
      m.put("createdAt", s.getCreatedAt().toString());
      out.add(m);
    }
    return out;
  }

  // ---- categories / suppliers --------------------------------------------

  @Transactional(readOnly = true)
  public List<CategoryView> listCategories(AuthPrincipal user) {
    if (!Rbdc.hasModuleAccess(user, "read", "M15")) throw ApiException.forbidden("M15", "read");
    List<String> scoped = scopedPropertyIds(user);
    return categories.findVisible(scoped.isEmpty() ? List.of("__none__") : scoped).stream()
        .map(c -> new CategoryView(c.getId(), c.getName(), c.getParentId(), c.getPropertyId(),
            c.getSortOrder(), c.isActive(),
            items.countByCategoryId(c.getId()), categories.countByParentId(c.getId())))
        .toList();
  }

  @Transactional
  public String createCategory(AuthPrincipal user, String name, String parentId, String propertyId) {
    if (propertyId != null) {
      requirePropertyCreate(user, propertyId);
    } else if (!Rbdc.can(user, "create", "M15")) {
      throw ApiException.forbidden("M15", "create"); // shared category needs a GLOBAL grant
    }
    if (name == null || name.trim().length() < 2) {
      throw new ApiException(400, "NAME_REQUIRED", "Category name (2+ chars) is required");
    }
    String cleanName = name.trim();
    if (parentId != null) {
      StockCategory parent = categories.findById(parentId)
          .orElseThrow(() -> ApiException.notFound("Parent category not found"));
      // Parent must share the child's scope, and only two levels are allowed.
      if ((parent.getPropertyId() == null) != (propertyId == null)
          || (propertyId != null && !propertyId.equals(parent.getPropertyId()))) {
        throw new ApiException(422, "SCOPE_MISMATCH", "Parent category belongs to a different scope");
      }
      if (parent.getParentId() != null) {
        throw new ApiException(422, "MAX_DEPTH", "Only two category levels are supported (parent/child)");
      }
    }
    boolean dup = categories.findByName(cleanName).stream().anyMatch(c ->
        java.util.Objects.equals(c.getParentId(), parentId)
            && java.util.Objects.equals(c.getPropertyId(), propertyId));
    if (dup) throw ApiException.duplicate("A category \"" + cleanName + "\" already exists here");

    StockCategory cat = new StockCategory(cleanName, parentId, propertyId);
    categories.save(cat);
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M15").action("category.created").entityType("stock_category").entityId(cat.getId())
        .summary("Stock category \"" + cat.getName() + "\" created")
        .build());
    return cat.getId();
  }

  @Transactional(readOnly = true)
  public List<SupplierView> listSuppliers(AuthPrincipal user) {
    if (!Rbdc.can(user, "read", "M15")) throw ApiException.forbidden("M15", "read");
    return suppliers.findAllByOrderByNameAsc().stream()
        .map(s -> new SupplierView(s.getId(), s.getName(), s.getPhone(), s.getEmail(), s.getNotes()))
        .toList();
  }

  @Transactional
  public String createSupplier(AuthPrincipal user, String name, String phone, String email, String notes) {
    if (!Rbdc.can(user, "create", "M15")) throw ApiException.forbidden("M15", "create");
    if (name == null || name.trim().length() < 2) {
      throw new ApiException(400, "NAME_REQUIRED", "Supplier name (2+ chars) is required");
    }
    if (suppliers.findByName(name.trim()).isPresent()) {
      throw ApiException.duplicate("Supplier \"" + name.trim() + "\" already exists");
    }
    Supplier s = new Supplier(name.trim(), emptyToNull(phone), emptyToNull(email), emptyToNull(notes));
    suppliers.save(s);
    audit.log(AuditEntry.builder()
        .actorId(user.id()).actorName(user.name())
        .module("M15").action("supplier.created").entityType("supplier").entityId(s.getId())
        .summary("Supplier \"" + s.getName() + "\" created")
        .build());
    return s.getId();
  }

  // ---- helpers ------------------------------------------------------------

  /**
   * "1 carton = 12 bottle": both pack sides required together, packSize ≥ 2, and
   * the pack unit must differ from the base unit. Returns an error string or null.
   */
  private static String validatePack(String unit, String packUnit, Integer packSize) {
    String pu = packUnit == null ? null : packUnit.trim();
    boolean hasUnit = pu != null && !pu.isEmpty();
    boolean hasSize = packSize != null && packSize > 0;
    if (!hasUnit && !hasSize) return null;
    if (!hasUnit || !hasSize) return "Both pack unit and pack size are required together";
    if (packSize < 2) return "Pack size must be at least 2";
    if (pu.equalsIgnoreCase(unit.trim())) return "Pack unit and base unit must differ";
    return null;
  }

  /** Resolve the "Parent/Child" snapshot for a category id; fall back to the string. */
  private String resolveCategorySnapshot(String categoryId, String fallback) {
    if (categoryId != null) {
      StockCategory cat = categories.findById(categoryId).orElse(null);
      if (cat != null) {
        StockCategory parent = cat.getParentId() != null
            ? categories.findById(cat.getParentId()).orElse(null) : null;
        return parent != null ? parent.getName() + "/" + cat.getName() : cat.getName();
      }
    }
    return fallback != null && !fallback.trim().isEmpty() ? fallback.trim() : "other";
  }

  /** Property ids the user may read (GLOBAL → every property, else their scope). */
  private List<String> scopedPropertyIds(AuthPrincipal user) {
    String scope = Rbdc.widestScope(user, "read", "M15");
    if ("GLOBAL".equals(scope)) return propertiesApi.allPropertyIds();
    return user.propertyIds();
  }

  private void requirePropertyRead(AuthPrincipal user, String propertyId) {
    requireProperty(user, "read", propertyId);
  }

  private void requirePropertyCreate(AuthPrincipal user, String propertyId) {
    requireProperty(user, "create", propertyId);
  }

  /** {@code can(user, action, M15, {propertyId})} or GLOBAL — else 403. */
  private void requireProperty(AuthPrincipal user, String action, String propertyId) {
    if (!Rbdc.can(user, action, "M15", Rbdc.ResourceRef.property(propertyId))) {
      throw new ApiException(403, "FORBIDDEN",
          "Missing permission M15:" + action + " for this property");
    }
  }

  private static String emptyToNull(String v) {
    if (v == null) return null;
    String t = v.trim();
    return t.isEmpty() ? null : t;
  }

  private static String fmt3(int milli) {
    return String.format("%.3f", milli / 1000.0);
  }

  private static String fmt4(int costMilli) {
    return String.format("%.4f", costMilli / 100_000.0);
  }

  private static String money(int minor) {
    return String.format("%.2f", minor / 100.0);
  }
}
