package com.rentmanager.platform.web;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Renders errors in the exact {@code {error, message}} shape the Next handlers
 * use (src/lib/api.ts {@code fail()}), so the frontend error handling is
 * unchanged across the split.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(ApiException.class)
  public ResponseEntity<Map<String, String>> handleApi(ApiException ex) {
    return ResponseEntity.status(ex.status())
        .body(Map.of("error", ex.code(), "message", ex.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
    var first = ex.getBindingResult().getFieldErrors().stream().findFirst();
    String field = first.map(f -> f.getField()).orElse("body");
    String msg = first.map(f -> f.getDefaultMessage()).orElse("Invalid request");
    return ResponseEntity.badRequest()
        .body(Map.of("error", "VALIDATION_ERROR", "message", field + ": " + msg));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, String>> handleUnexpected(Exception ex) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", "INTERNAL", "message", "Unexpected error"));
  }
}
