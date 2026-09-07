package com.rentmanager.properties.web;

import com.rentmanager.properties.domain.Building;
import com.rentmanager.properties.domain.Floor;
import com.rentmanager.properties.domain.Property;
import com.rentmanager.properties.domain.Room;
import com.rentmanager.properties.dto.CreatePropertyRequest;
import com.rentmanager.properties.dto.RoomStatusRequest;
import com.rentmanager.properties.service.PropertyService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST for M04, mirroring the Next routes
 * {@code /api/properties}, {@code /api/buildings}, {@code /api/floors},
 * {@code /api/rooms/[id]/status}.
 */
@RestController
public class PropertyController {

  private final PropertyService service;
  private final CurrentUser currentUser;

  public PropertyController(PropertyService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping("/api/properties")
  public List<Map<String, Object>> listProperties() {
    AuthPrincipal user = currentUser.require();
    return service.listProperties(user).stream().map(this::propertyJson).toList();
  }

  @PostMapping("/api/properties")
  public ResponseEntity<Map<String, Object>> createProperty(@Valid @RequestBody CreatePropertyRequest body) {
    AuthPrincipal user = currentUser.require();
    Property p = service.createProperty(user, body.code(), body.name(), body.address());
    return ResponseEntity.status(HttpStatus.CREATED).body(propertyJson(p));
  }

  @GetMapping("/api/properties/{id}")
  public Map<String, Object> getProperty(@PathVariable String id) {
    AuthPrincipal user = currentUser.require();
    return propertyJson(service.getProperty(user, id));
  }

  @GetMapping("/api/buildings")
  public List<Map<String, Object>> listBuildings(@RequestParam String propertyId) {
    AuthPrincipal user = currentUser.require();
    return service.listBuildings(user, propertyId).stream().map(this::buildingJson).toList();
  }

  @GetMapping("/api/floors")
  public List<Map<String, Object>> listFloors(@RequestParam String buildingId) {
    AuthPrincipal user = currentUser.require();
    return service.listFloors(user, buildingId).stream().map(f -> Map.<String, Object>of(
        "id", f.getId(), "buildingId", f.getBuildingId(), "name", f.getName(), "level", f.getLevel()))
        .toList();
  }

  @GetMapping("/api/rooms")
  public List<Map<String, Object>> listRooms(@RequestParam String floorId) {
    AuthPrincipal user = currentUser.require();
    return service.listRooms(user, floorId).stream().map(this::roomJson).toList();
  }

  @PostMapping("/api/rooms/{id}/status")
  public Map<String, Object> changeRoomStatus(
      @PathVariable String id, @Valid @RequestBody RoomStatusRequest body) {
    AuthPrincipal user = currentUser.require();
    return roomJson(service.changeRoomStatus(user, id, body.status()));
  }

  private Map<String, Object> propertyJson(Property p) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", p.getId());
    m.put("code", p.getCode());
    m.put("name", p.getName());
    m.put("address", p.getAddress());
    m.put("status", p.getStatus());
    return m;
  }

  private Map<String, Object> buildingJson(Building b) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", b.getId());
    m.put("propertyId", b.getPropertyId());
    m.put("name", b.getName());
    m.put("address", b.getAddress());
    return m;
  }

  private Map<String, Object> roomJson(Room r) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", r.getId());
    m.put("floorId", r.getFloorId());
    m.put("number", r.getNumber());
    m.put("type", r.getType());
    m.put("status", r.getStatus());
    m.put("basePriceMinor", r.getBasePriceMinor());
    m.put("capacity", r.getCapacity());
    return m;
  }
}
