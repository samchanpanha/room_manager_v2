package com.rentmanager.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Smoke tests confirming the M15 inventory controllers are wired at the Next
 * paths and reject anonymous callers with the shared {@code UNAUTHENTICATED}
 * body (the deeper RBDC + movement logic is covered by StockRulesTest and the
 * TS contract tests).
 */
@SpringBootTest
@AutoConfigureMockMvc
class StockEndpointsTest {

  @Autowired MockMvc mvc;

  @Test
  void itemsListRequiresAuth() throws Exception {
    mvc.perform(get("/api/stock/items"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
  }

  @Test
  void valuationRequiresAuth() throws Exception {
    mvc.perform(get("/api/stock/valuation"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
  }

  @Test
  void categoriesListRequiresAuth() throws Exception {
    mvc.perform(get("/api/stock/categories"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
  }

  @Test
  void suppliersListRequiresAuth() throws Exception {
    mvc.perform(get("/api/stock/suppliers"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
  }

  @Test
  void stocktakesListRequiresAuth() throws Exception {
    mvc.perform(get("/api/stock/stocktakes"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
  }

  @Test
  void purchaseRequiresAuth() throws Exception {
    mvc.perform(post("/api/stock/purchase")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"stockItemId\":\"x\",\"qty\":10,\"unitCost\":1.5}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
  }
}
