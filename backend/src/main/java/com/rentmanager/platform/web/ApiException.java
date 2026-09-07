package com.rentmanager.platform.web;

/**
 * Domain/HTTP error carrying the same {@code {error, message}} shape and status
 * codes the Next handlers return (see src/lib/api.ts {@code fail()}), so the
 * frontend contract is unchanged.
 */
public class ApiException extends RuntimeException {

  private final int status;
  private final String code;

  public ApiException(int status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  public int status() { return status; }
  public String code() { return code; }

  public static ApiException unauthenticated() {
    return new ApiException(401, "UNAUTHENTICATED", "Sign in required");
  }
  public static ApiException badCredentials() {
    return new ApiException(401, "BAD_CREDENTIALS", "Invalid email or password");
  }
  public static ApiException forbidden(String module, String action) {
    return new ApiException(403, "FORBIDDEN", "Missing permission " + module + ":" + action);
  }
  public static ApiException notFound(String message) {
    return new ApiException(404, "NOT_FOUND", message);
  }
  public static ApiException duplicate(String message) {
    return new ApiException(409, "DUPLICATE", message);
  }
  public static ApiException validation(String message) {
    return new ApiException(400, "VALIDATION_ERROR", message);
  }
}
