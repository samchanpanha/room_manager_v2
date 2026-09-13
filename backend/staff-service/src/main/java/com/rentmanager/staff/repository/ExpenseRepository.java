package com.rentmanager.staff.repository;

import com.rentmanager.staff.domain.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, String> {
    List<Expense> findByPropertyId(String propertyId);
    List<Expense> findByStatus(String status);
    Optional<Expense> findByCode(String code);
}
