package com.squareone.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.squareone.model.Document;

public interface DocumentRepository extends JpaRepository<Document, String> {
}
