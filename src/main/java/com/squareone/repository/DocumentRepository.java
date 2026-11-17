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

    List<Document> findAllByWorkspaceIdOrderByUpdatedAtDesc(String workspaceId);

    @Modifying
    @Query("update Document d set d.ownerUser = :owner, d.guestId = null, d.workspaceId = :workspaceId, d.rowVersion = d.rowVersion + 1 where d.guestId = :guestId")
    int transferGuestWorkspace(@Param("guestId") String guestId, @Param("owner") AppUser owner, @Param("workspaceId") String workspaceId);

    List<Document> findAllByOwnerUser_IdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    List<Document> findAllByGuestIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String guestId);

    List<Document> findAllByOwnerUser_IdAndDeletedAtIsNotNullOrderByDeletedAtDesc(String ownerUserId);

    List<Document> findAllByGuestIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(String guestId);

    Optional<Document> findByIdAndOwnerUser_Id(String id, String ownerUserId);

    Optional<Document> findByIdAndGuestId(String id, String guestId);

    @Modifying
    @Query("update Document document set document.parentId = null "
            + "where document.parentId = :parentId and document.ownerUser.id = :ownerUserId")
    int promoteChildrenOfUser(
            @Param("parentId") String parentId,
            @Param("ownerUserId") String ownerUserId);

    @Modifying
    @Query("update Document document set document.parentId = null "
            + "where document.parentId = :parentId and document.guestId = :guestId")
    int promoteChildrenOfGuest(
            @Param("parentId") String parentId,
            @Param("guestId") String guestId);

    @Modifying
    @Transactional
    @Query("update Document document set document.ownerUser = :owner, document.guestId = null "
            + "where document.guestId = :guestId")
    int transferGuestDocuments(@Param("guestId") String guestId, @Param("owner") AppUser owner);
}
