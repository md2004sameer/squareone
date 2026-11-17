package com.squareone.service;

import com.squareone.model.*;
import com.squareone.repository.*;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Transactional
public class DocumentService {
    private final DocumentRepository documents;
    private final AppUserRepository users;
    private final WorkspaceService workspaces;
    private final DocumentVersionRepository versions;
    private final EntityManager entityManager;
    public DocumentService(DocumentRepository documents, AppUserRepository users, WorkspaceService workspaces,
            DocumentVersionRepository versions, EntityManager entityManager) {
        this.documents = documents; this.users = users; this.workspaces = workspaces;
        this.versions = versions; this.entityManager = entityManager;
    }
    public Document createDocument(DocumentOwner owner) { return createDocument(owner, null, "", null); }
    public Document createDocument(DocumentOwner owner, String title, String content, Map<String, Object> contentJson) {
        Workspace workspace = workspaces.resolve(owner); workspaces.lock(workspace.getId(), owner);
        Document document = new Document(); document.setWorkspaceId(workspace.getId());
        document.setTitle(title == null ? "Untitled" : title); document.setContent(content == null ? "" : content);
        document.setContentJson(contentJson); document.setSortOrder(nextOrder(workspace.getId(), null));
        if (owner.userId() != null) document.setOwnerUser(users.getReferenceById(owner.userId()));
        else document.setGuestId(owner.guestId());
        document = documents.saveAndFlush(document); checkpoint(document, owner, "created"); return document;
    }
    public Document duplicateDocument(String id, DocumentOwner owner) {
        Document source = lockDocument(id, owner);
        String title = source.getTitle().isBlank() ? "Untitled" : source.getTitle();
        Document duplicate = createDocument(owner.inWorkspace(source.getWorkspaceId()),
                title.substring(0, Math.min(title.length(), 153)) + " (copy)", source.getContent(), source.getContentJson());
        duplicate.setParentId(source.getParentId()); duplicate.setIcon(source.getIcon()); duplicate.setCoverRef(source.getCoverRef());
        duplicate.setSortOrder(nextOrder(source.getWorkspaceId(), source.getParentId()));
        return documents.saveAndFlush(duplicate);
    }
    public List<Document> getAllDocuments(DocumentOwner owner) { return list(owner, false, false); }
    public List<Document> getArchive(DocumentOwner owner) { return list(owner, true, false); }
    public List<Document> getTrash(DocumentOwner owner) { return list(owner, false, true); }
    private List<Document> list(DocumentOwner owner, boolean archived, boolean trash) {
        String workspaceId = workspaces.resolve(owner).getId();
        return documents.findAllByWorkspaceIdOrderByUpdatedAtDesc(workspaceId).stream()
                .filter(document -> trash ? document.getDeletedAt() != null
                        : document.getDeletedAt() == null && document.isArchived() == archived).toList();
    }
    public Document getDocument(String id, DocumentOwner owner) {
        Document document = findOwned(id, owner);
        if (document.getDeletedAt() != null) throw notFound();
        return document;
    }
    private Document findOwned(String id, DocumentOwner owner) {
        Document document = (owner.userId() != null ? documents.findByIdAndOwnerUser_Id(id, owner.userId())
                : documents.findByIdAndGuestId(id, owner.guestId())).orElseThrow(this::notFound);
        if (document.getWorkspaceId() == null || (owner.workspaceId() != null && !owner.workspaceId().equals(document.getWorkspaceId()))) throw notFound();
        workspaces.owned(document.getWorkspaceId(), owner); return document;
    }
    private Document lockOwnedDocument(String id, DocumentOwner owner) {
        Document document = findOwned(id, owner); workspaces.lock(document.getWorkspaceId(), owner);
        entityManager.refresh(document);
        // Re-check after waiting for a concurrent workspace mutation or guest transfer.
        document = findOwned(id, owner);
        return document;
    }
    private Document lockDocument(String id, DocumentOwner owner) {
        Document document = lockOwnedDocument(id, owner);
        if (document.getDeletedAt() != null) throw notFound();
        return document;
    }
    public Document updateDocument(String id, DocumentOwner owner, String title, String content) {
        return updateDocument(id, owner, title, content, null, null);
    }
    public Document updateDocument(String id, DocumentOwner owner, String title, String content,
            Map<String, Object> contentJson, Long expectedRevision) {
        Document document = lockDocument(id, owner); checkRevision(document, expectedRevision);
        if (Objects.equals(document.getTitle(), title) && Objects.equals(document.getContent(), content)
                && Objects.equals(document.getContentJson(), contentJson)) return document;
        document.setTitle(title); document.setContent(content); document.setContentJson(contentJson);
        document.setRevision(document.getRevision() + 1); document.setLastEditedAt(System.currentTimeMillis());
        document.setUpdatedAt(document.getLastEditedAt()); documents.saveAndFlush(document);
        Optional<DocumentVersion> last = versions.findFirstByDocumentIdOrderByRevisionDesc(id);
        if (last.isEmpty() || System.currentTimeMillis() - last.get().getCreatedAt() >= 60000
                || (last.get().getContent().isBlank() && !content.isBlank())) checkpoint(document, owner, "autosave");
        return document;
    }
    public Document updateDocumentOrganization(String id, DocumentOwner owner, String parentId, boolean favorite) {
        return organize(id, owner, parentId, favorite, null, null, null);
    }
    public Document organize(String id, DocumentOwner owner, String parentId, Boolean favorite,
            Boolean archived, String direction, Long rowVersion) {
        Document document = lockDocument(id, owner);
        if (rowVersion != null && rowVersion != document.getRowVersion()) throw new PersistenceConflictException();
        String parent = parentId == null || parentId.isBlank() ? null : parentId;
        if (parent != null) {
            Document candidate = getDocument(parent, owner);
            if (!candidate.getWorkspaceId().equals(document.getWorkspaceId()) || candidate.isArchived()) throw new IllegalArgumentException("Parent must be in this workspace");
            Set<String> visited = new HashSet<>(Set.of(id));
            while (candidate != null) {
                if (!visited.add(candidate.getId())) throw new IllegalArgumentException("A document cannot be moved under itself or a descendant");
                candidate = candidate.getParentId() == null ? null : getDocument(candidate.getParentId(), owner);
            }
        }
        if (!Objects.equals(parent, document.getParentId())) {
            document.setParentId(parent); document.setSortOrder(nextOrder(document.getWorkspaceId(), parent));
        }
        if (favorite != null) document.setFavorite(favorite);
        if (archived != null && archived != document.isArchived()) {
            document.setArchived(archived);
            if (archived) promoteChildren(document);
        }
        if (direction != null) reorder(document, direction);
        document.setUpdatedAt(System.currentTimeMillis()); return documents.saveAndFlush(document);
    }
    public Document updateAppearance(String id, DocumentOwner owner, String icon, String coverRef, Long rowVersion) {
        Document document = lockDocument(id, owner);
        if (rowVersion != null && rowVersion != document.getRowVersion()) throw new PersistenceConflictException();
        document.setIcon(icon == null || icon.isBlank() ? null : icon);
        document.setCoverRef(coverRef == null || coverRef.isBlank() ? null : coverRef);
        document.setUpdatedAt(System.currentTimeMillis()); return documents.saveAndFlush(document);
    }
    private void reorder(Document document, String direction) {
        if (!Set.of("up", "down").contains(direction)) throw new IllegalArgumentException("Choose up or down");
        List<Document> siblings = documents.findAllByWorkspaceIdOrderByUpdatedAtDesc(document.getWorkspaceId()).stream()
                .filter(d -> d.getDeletedAt() == null && !d.isArchived() && Objects.equals(d.getParentId(), document.getParentId()))
                .sorted(Comparator.comparingLong(Document::getSortOrder).thenComparing(Document::getId)).toList();
        for (int i = 0; i < siblings.size(); i++) siblings.get(i).setSortOrder((i + 1L) * 1024);
        int index = siblings.indexOf(document), target = index + (direction.equals("up") ? -1 : 1);
        if (target >= 0 && target < siblings.size()) {
            long order = document.getSortOrder(); document.setSortOrder(siblings.get(target).getSortOrder()); siblings.get(target).setSortOrder(order);
        }
        documents.saveAll(siblings);
    }
    private long nextOrder(String workspaceId, String parentId) {
        return documents.findAllByWorkspaceIdOrderByUpdatedAtDesc(workspaceId).stream()
                .filter(d -> d.getDeletedAt() == null && Objects.equals(d.getParentId(), parentId))
                .mapToLong(Document::getSortOrder).max().orElse(0) + 1024;
    }
    public void deleteDocument(String id, DocumentOwner owner) {
        Document document = lockDocument(id, owner); checkpoint(document, owner, "before-trash"); promoteChildren(document);
        document.setDeletedAt(System.currentTimeMillis()); document.setUpdatedAt(document.getDeletedAt()); documents.saveAndFlush(document);
    }
    private void promoteChildren(Document parent) {
        // Update managed children so row versions also change and the persistence context stays current.
        for (Document child : documents.findAllByWorkspaceIdOrderByUpdatedAtDesc(parent.getWorkspaceId())) {
            if (parent.getId().equals(child.getParentId())) { child.setParentId(null); child.setSortOrder(nextOrder(parent.getWorkspaceId(), null)); }
        }
        entityManager.flush();
    }
    public Document restoreDocument(String id, DocumentOwner owner) {
        Document document = lockOwnedDocument(id, owner);
        if (document.getDeletedAt() == null) throw notFound();
        if (document.getParentId() != null) {
            Document parent = findOwned(document.getParentId(), owner);
            if (parent.getDeletedAt() != null || parent.isArchived()) document.setParentId(null);
        }
        document.setDeletedAt(null); document.setUpdatedAt(System.currentTimeMillis()); return documents.saveAndFlush(document);
    }
    public void permanentlyDeleteDocument(String id, DocumentOwner owner) {
        Document document = lockOwnedDocument(id, owner);
        if (document.getDeletedAt() == null) throw notFound();
        // A trashed child may still refer to this parent; keep it independently restorable.
        promoteChildren(document); documents.delete(document); documents.flush();
    }
    public int transferGuestDocuments(String guestId, AppUser user) {
        if (guestId == null || guestId.isBlank()) return 0;
        Workspace target = workspaces.defaultForUser(user.getId());
        Workspace source = workspaces.resolve(DocumentOwner.guest(guestId));
        List<String> ids = new ArrayList<>(List.of(source.getId(), target.getId())); ids.sort(String::compareTo);
        for (String id : ids) workspaces.lock(id, id.equals(source.getId()) ? DocumentOwner.guest(guestId) : DocumentOwner.user(user.getId()));
        int count = documents.transferGuestWorkspace(guestId, user, target.getId()); entityManager.clear(); return count;
    }
    public List<DocumentVersion> getVersions(String id, DocumentOwner owner) { getDocument(id, owner); return versions.findAllByDocumentIdOrderByRevisionDesc(id); }
    public DocumentVersion getVersion(String id, String versionId, DocumentOwner owner) {
        getDocument(id, owner); return versions.findByIdAndDocumentId(versionId, id).orElseThrow(this::notFound);
    }
    public DocumentVersion createCheckpoint(String id, DocumentOwner owner) { return checkpoint(lockDocument(id, owner), owner, "checkpoint"); }
    private DocumentVersion checkpoint(Document document, DocumentOwner owner, String reason) {
        return versions.findByDocumentIdAndRevision(document.getId(), document.getRevision()).orElseGet(() -> {
            DocumentVersion version = new DocumentVersion(); version.setDocumentId(document.getId()); version.setRevision(document.getRevision());
            version.setTitle(document.getTitle()); version.setContent(document.getContent()); version.setContentJson(document.getContentJson());
            version.setContentFormat(document.getContentFormat()); version.setFormatVersion(document.getFormatVersion());
            version.setEditorUserId(owner.userId()); version.setReason(reason); return versions.saveAndFlush(version);
        });
    }
    public Document restoreVersion(String id, String versionId, DocumentOwner owner, Long expectedRevision) {
        Document document = lockDocument(id, owner); checkRevision(document, expectedRevision);
        DocumentVersion snapshot = getVersion(id, versionId, owner); checkpoint(document, owner, "before-restore");
        document.setTitle(snapshot.getTitle()); document.setContent(snapshot.getContent()); document.setContentJson(snapshot.getContentJson());
        document.setContentFormat(snapshot.getContentFormat()); document.setFormatVersion(snapshot.getFormatVersion());
        document.setRevision(document.getRevision() + 1); document.setLastEditedAt(System.currentTimeMillis()); document.setUpdatedAt(document.getLastEditedAt());
        documents.saveAndFlush(document); checkpoint(document, owner, "restored"); return document;
    }
    private void checkRevision(Document document, Long expectedRevision) {
        if (expectedRevision != null && document.getRevision() != expectedRevision) throw new PersistenceConflictException();
    }
    private IllegalArgumentException notFound() { return new IllegalArgumentException("Document not found"); }
}
