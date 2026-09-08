/**
 * Inventory SPI (M15): ports the inventory module publishes for not-yet-ported
 * modules to implement, so the dependency arrow points into inventory (inversion)
 * and the module graph stays acyclic. {@link com.rentmanager.inventory.spi.MaintenanceCostPort}
 * lets maintenance (M19) attach a material cost line when a part is consumed.
 */
@org.springframework.modulith.NamedInterface("spi")
package com.rentmanager.inventory.spi;
