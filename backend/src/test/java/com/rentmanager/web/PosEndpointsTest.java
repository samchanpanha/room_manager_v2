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
 * Smoke tests confirming the M14 POS controllers are wired at the Next paths and
 * reject anonymous callers with the shared {@code UNAUTHENTICATED} body (the
 * deeper RBDC + sale/session logic is covered by PosRulesTest + the TS suites).
 */
@SpringBootTest
@AutoConfigureMockMvc
class PosEndpointsTest {

  @Autowired MockMvc mvc;

  @Test
  void productsListRequiresAuth() throws Exception {
    mvc.perform(get("/api/pos/products"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
  }

  @Test
  void sessionsListRequiresAuth() throws Exception {
    mvc.perform(get("/api/pos/sessions"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
  }

  @Test
  void salesListRequiresAuth() throws Exception {
    mvc.perform(get("/api/pos/sales"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
  }

  @Test
  void recordSaleRequiresAuth() throws Exception {
    mvc.perform(post("/api/pos/sales")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"sessionId\":\"x\",\"method\":\"cash\",\"lines\":[{\"productId\":\"p\",\"qty\":1}]}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
  }
}
