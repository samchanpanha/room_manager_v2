package com.rentmanager.kernel.numbering;

import com.rentmanager.kernel.tenant.TenantContext;
import java.util.function.IntFunction;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gapless sequence numbers (INTENT.md M00) — a port of {@code src/lib/numbering.ts}.
 * Row-locked increment so concurrent callers never collide. Public kernel API.
 */
@Service
public class NumberingService {

  private final NumberSequenceRepository repo;

  public NumberingService(NumberSequenceRepository repo) {
    this.repo = repo;
  }

  @Transactional
  public String next(String key, IntFunction<String> format) {
    NumberSequence seq = repo.findForUpdate(key).orElseGet(() ->
        repo.save(new NumberSequence(key, 0, TenantContext.get())));
    seq.setValue(seq.getValue() + 1);
    repo.save(seq);
    return format.apply(seq.getValue());
  }
}
