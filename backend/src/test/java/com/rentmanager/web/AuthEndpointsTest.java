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
 * Smoke tests for the auth/authz surface against the H2 test profile:
 * - protected endpoints reject anonymous callers with the Next-compatible
 *   {@code {error: "UNAUTHENTICATED"}} body;
 * - bad credentials return 401 {@code BAD_CREDENTIALS};
 * - health is public.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AuthEndpointsTest {

  @Autowired MockMvc mvc;

  @Test
  void healthIsPublic() throws Exception {
    mvc.perform(get("/api/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ok"));
  }

  @Test
  void accountRequiresAuth() throws Exception {
    mvc.perform(get("/api/account"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
  }

  @Test
  void membersListRequiresAuth() throws Exception {
    mvc.perform(get("/api/members"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
  }

  @Test
  void loginWithUnknownUserIsRejected() throws Exception {
    mvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"nobody@example.com\",\"password\":\"whatever\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("BAD_CREDENTIALS"));
  }

  @Test
  void loginValidationErrorOnMissingFields() throws Exception {
    mvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"not-an-email\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
  }
}
