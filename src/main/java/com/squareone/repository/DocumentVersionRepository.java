package com.squareone.repository;
import com.squareone.model.DocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, String> {
    Optional<DocumentVersion> findFirstByDocumentIdOrderByRevisionDesc(String documentId);
    Optional<DocumentVersion> findByIdAndDocumentId(String id, String documentId);
    Optional<DocumentVersion> findByDocumentIdAndRevision(String documentId, long revision);
    List<DocumentVersion> findAllByDocumentIdOrderByRevisionDesc(String documentId);
}
