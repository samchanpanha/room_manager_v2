package com.rentmanager.staff.repository;

import com.rentmanager.staff.domain.ExpenseCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExpenseCategoryRepository extends JpaRepository<ExpenseCategory, String> {
    List<ExpenseCategory> findByPropertyId(String propertyId);
}
