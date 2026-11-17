package com.squareone.service;

import com.squareone.model.Workspace;
import com.squareone.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Transactional
public class WorkspaceService {
    private final WorkspaceRepository workspaces;
    private final AppUserRepository users;
    public WorkspaceService(WorkspaceRepository workspaces, AppUserRepository users) {
        this.workspaces = workspaces; this.users = users;
    }
    public Workspace defaultForUser(String userId) {
        users.lockById(userId).orElseThrow(() -> new IllegalArgumentException("Account not found"));
        return workspaces.findByDefaultForUserId(userId).orElseGet(() -> {
            Workspace workspace = new Workspace();
            // Preserve existing workspace/cache identifiers during adoption.
            workspace.setId(userId); workspace.setName("My workspace");
            workspace.setOwnerUserId(userId); workspace.setDefaultForUserId(userId);
            return workspaces.saveAndFlush(workspace);
        });
    }
    public Workspace resolve(DocumentOwner owner) {
        if (owner.workspaceId() != null) return owned(owner.workspaceId(), owner);
        if (owner.userId() != null) return defaultForUser(owner.userId());
        return workspaces.findById(owner.guestId()).orElseGet(() -> {
            Workspace workspace = new Workspace(); workspace.setId(owner.guestId());
            workspace.setGuestId(owner.guestId()); workspace.setName("Guest workspace");
            return workspaces.saveAndFlush(workspace);
        });
    }
    public Workspace owned(String id, DocumentOwner owner) {
        Workspace workspace = workspaces.findById(id).orElseThrow(() -> new IllegalArgumentException("Workspace not found"));
        boolean allowed = owner.userId() != null ? owner.userId().equals(workspace.getOwnerUserId())
                : owner.guestId().equals(workspace.getGuestId());
        if (!allowed) throw new IllegalArgumentException("Workspace not found");
        return workspace;
    }
    public Workspace lock(String id, DocumentOwner owner) {
        Workspace workspace = workspaces.lockById(id).orElseThrow(() -> new IllegalArgumentException("Workspace not found"));
        owned(id, owner); return workspace;
    }
    public List<Workspace> list(String userId) {
        defaultForUser(userId); return workspaces.findAllByOwnerUserIdOrderByCreatedAtAsc(userId);
    }
    public Workspace create(String userId, String name, String description) {
        defaultForUser(userId);
        Workspace workspace = new Workspace(); workspace.setOwnerUserId(userId);
        workspace.setName(name.strip()); workspace.setDescription(description == null ? "" : description);
        return workspaces.save(workspace);
    }
    public Workspace update(String id, DocumentOwner owner, String name, String description) {
        Workspace workspace = lock(id, owner); workspace.setName(name.strip());
        workspace.setDescription(description == null ? "" : description); workspace.setUpdatedAt(System.currentTimeMillis());
        return workspaces.save(workspace);
    }
}
