package com.rentmanager.billing.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CreditNoteRepository extends JpaRepository<CreditNote, String> {
  List<CreditNote> findByInvoiceIdOrderByIssuedAtDesc(String invoiceId);
}
