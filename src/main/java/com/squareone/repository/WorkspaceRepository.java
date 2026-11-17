package com.squareone.repository;
import com.squareone.model.Workspace;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface WorkspaceRepository extends JpaRepository<Workspace, String> {
    Optional<Workspace> findByDefaultForUserId(String userId);
    List<Workspace> findAllByOwnerUserIdOrderByCreatedAtAsc(String userId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from Workspace w where w.id = :id")
    Optional<Workspace> lockById(@Param("id") String id);
}
