package com.squareone.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.squareone.model.AppUser;
import com.squareone.model.Document;

public interface DocumentRepository extends JpaRepository<Document, String> {

    List<Document> findAllByOwnerUser_IdOrderByUpdatedAtDesc(String ownerUserId);

    List<Document> findAllByGuestIdOrderByUpdatedAtDesc(String guestId);

    Optional<Document> findByIdAndOwnerUser_Id(String id, String ownerUserId);

    Optional<Document> findByIdAndGuestId(String id, String guestId);

    @Modifying
    @Transactional
    @Query("update Document document set document.ownerUser = :owner, document.guestId = null "
            + "where document.guestId = :guestId")
    int transferGuestDocuments(@Param("guestId") String guestId, @Param("owner") AppUser owner);
}
