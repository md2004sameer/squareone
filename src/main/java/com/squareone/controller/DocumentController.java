package com.squareone.controller;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.RequestParam;
import com.squareone.model.DocumentVersion;

import jakarta.servlet.http.HttpSession;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.squareone.model.Document;
import com.squareone.security.AppUserDetails;
import com.squareone.security.GuestSessionService;
import com.squareone.service.DocumentOwner;
import com.squareone.service.DocumentExportService;
import com.squareone.service.DocumentService;
import com.squareone.service.WhatsAppShareService;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;
    private final DocumentExportService documentExportService;
    private final WhatsAppShareService whatsAppShareService;
    private final GuestSessionService guestSessionService;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    public DocumentController(
            DocumentService documentService,
            DocumentExportService documentExportService,
            WhatsAppShareService whatsAppShareService,
            GuestSessionService guestSessionService,
            org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.documentService = documentService;
        this.documentExportService = documentExportService;
        this.whatsAppShareService = whatsAppShareService;
        this.guestSessionService = guestSessionService;
        this.jdbc = jdbc;
    }

    @PostMapping
    public ResponseEntity<DocumentResponse> createDocument(
            @Valid @RequestBody(required = false) CreateRequest request,
            @AuthenticationPrincipal AppUserDetails principal,
            HttpSession session) {
        DocumentOwner owner = resolveOwner(principal, session);
        if (request != null && request.workspaceId() != null) owner = owner.inWorkspace(request.workspaceId());
        Document document = request == null ? documentService.createDocument(owner)
                : documentService.createDocument(owner, request.title(), request.content(), request.contentJson());
        URI location = URI.create("/api/documents/" + document.getId());
        return ResponseEntity.created(location).body(toResponse(document));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<DocumentResponse> duplicateDocument(
            @PathVariable String id,
            @AuthenticationPrincipal AppUserDetails principal,
            HttpSession session) {
        Document document = documentService.duplicateDocument(id, resolveOwner(principal, session));
        URI location = URI.create("/api/documents/" + document.getId());
        return ResponseEntity.created(location).body(toResponse(document));
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        try {
            jdbc.queryForObject("SELECT 1", Integer.class);
            return ResponseEntity.ok("OK");
        } catch (org.springframework.dao.DataAccessException exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body("Unavailable");
        }
    }

    @GetMapping
    public List<DocumentResponse> getAllDocuments(
            @RequestParam(required = false) String workspaceId,
            @AuthenticationPrincipal AppUserDetails principal,
            HttpSession session) {
        DocumentOwner owner = resolveOwner(principal, session);
        return documentService.getAllDocuments(workspaceId == null ? owner : owner.inWorkspace(workspaceId)).stream()
                .map(this::toResponse)
                .toList();
    }

    @GetMapping("/{id}")
    public DocumentResponse getDocument(
            @PathVariable String id,
            @AuthenticationPrincipal AppUserDetails principal,
            HttpSession session) {
        return toResponse(documentService.getDocument(id, resolveOwner(principal, session)));
    }

    @GetMapping("/trash")
    public List<DocumentResponse> getTrash(
            @AuthenticationPrincipal AppUserDetails principal, HttpSession session) {
        return documentService.getTrash(resolveOwner(principal, session)).stream()
                .map(this::toResponse).toList();
    }

    @PostMapping("/trash/{id}/restore")
    public DocumentResponse restoreDocument(
            @PathVariable String id,
            @AuthenticationPrincipal AppUserDetails principal, HttpSession session) {
        return toResponse(documentService.restoreDocument(id, resolveOwner(principal, session)));
    }

    @DeleteMapping("/trash/{id}")
    public ResponseEntity<Void> permanentlyDeleteDocument(
            @PathVariable String id,
            @AuthenticationPrincipal AppUserDetails principal, HttpSession session) {
        documentService.permanentlyDeleteDocument(id, resolveOwner(principal, session));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}")
    public DocumentResponse updateDocument(
            @PathVariable String id,
            @Valid @RequestBody DocumentRequest request,
            @AuthenticationPrincipal AppUserDetails principal,
            HttpSession session) {
        return toResponse(documentService.updateDocument(
                id, resolveOwner(principal, session), request.title(), request.content(), request.contentJson(), request.revision()));
    }

    @PutMapping("/{id}/organization")
    public DocumentResponse updateDocumentOrganization(
            @PathVariable String id,
            @Valid @RequestBody OrganizationRequest request,
            @AuthenticationPrincipal AppUserDetails principal,
            HttpSession session) {
        return toResponse(documentService.organize(
                id,
                resolveOwner(principal, session),
                request.parentId(),
                request.favorite(), request.archived(), request.direction(), request.rowVersion()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(
            @PathVariable String id,
            @AuthenticationPrincipal AppUserDetails principal,
            HttpSession session) {
        documentService.deleteDocument(id, resolveOwner(principal, session));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/export/{format}")
    public ResponseEntity<byte[]> exportDocument(
            @PathVariable String id,
            @PathVariable String format,
            @AuthenticationPrincipal AppUserDetails principal,
            HttpSession session) throws IOException {
        DocumentExportService.ExportedDocument exported =
                documentExportService.export(id, format, resolveOwner(principal, session));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(exported.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(exported.filename(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .cacheControl(CacheControl.noStore())
                .body(exported.content());
    }

    @GetMapping("/{id}/share/whatsapp")
    public WhatsAppShareResponse createWhatsAppShare(
            @PathVariable String id,
            @AuthenticationPrincipal AppUserDetails principal,
            HttpSession session) {
        return new WhatsAppShareResponse(whatsAppShareService.createShareUrl(id, resolveOwner(principal, session)));
    }

    @GetMapping("/archive")
    public List<DocumentResponse> archive(@AuthenticationPrincipal AppUserDetails principal, HttpSession session) {
        return documentService.getArchive(resolveOwner(principal, session)).stream().map(this::toResponse).toList();
    }
    @PutMapping("/{id}/appearance")
    public DocumentResponse appearance(@PathVariable String id, @Valid @RequestBody AppearanceRequest request,
            @AuthenticationPrincipal AppUserDetails principal, HttpSession session) {
        return toResponse(documentService.updateAppearance(id, resolveOwner(principal, session), request.icon(), request.coverRef(), request.rowVersion()));
    }
    @GetMapping("/{id}/versions")
    public List<VersionSummary> versions(@PathVariable String id, @AuthenticationPrincipal AppUserDetails principal, HttpSession session) {
        return documentService.getVersions(id, resolveOwner(principal, session)).stream().map(VersionSummary::from).toList();
    }
    @PostMapping("/{id}/versions")
    public VersionSummary checkpoint(@PathVariable String id, @AuthenticationPrincipal AppUserDetails principal, HttpSession session) {
        return VersionSummary.from(documentService.createCheckpoint(id, resolveOwner(principal, session)));
    }
    @GetMapping("/{id}/versions/{versionId}")
    public DocumentVersion version(@PathVariable String id, @PathVariable String versionId,
            @AuthenticationPrincipal AppUserDetails principal, HttpSession session) {
        return documentService.getVersion(id, versionId, resolveOwner(principal, session));
    }
    @PostMapping("/{id}/versions/{versionId}/restore")
    public DocumentResponse restoreVersion(@PathVariable String id, @PathVariable String versionId,
            @Valid @RequestBody RestoreVersionRequest request, @AuthenticationPrincipal AppUserDetails principal, HttpSession session) {
        return toResponse(documentService.restoreVersion(id, versionId, resolveOwner(principal, session), request.revision()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Void> handleDocumentNotFound() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    public record CreateRequest(@Size(max=160) String title, @Size(max=5000000) String content,
            Map<String,Object> contentJson, @Size(max=36) String workspaceId) {}
    public record DocumentRequest(@NotNull @Size(max=160) String title, @NotNull @Size(max=5000000) String content,
            Map<String,Object> contentJson, @Min(1) Long revision) {}
    public record OrganizationRequest(@Size(max=36) String parentId, Boolean favorite, Boolean archived,
            @Pattern(regexp="up|down") String direction, @Min(0) Long rowVersion) {}
    public record AppearanceRequest(@Size(max=32) String icon,
            @Size(max=2048) @Pattern(regexp="^(https?://[^\\s]+|/[^/][^\\s]*|)$") String coverRef, @Min(0) Long rowVersion) {}
    public record RestoreVersionRequest(@NotNull @Min(1) Long revision) {}
    public record VersionSummary(String id, long revision, String title, long createdAt, String editorUserId, String reason) {
        static VersionSummary from(DocumentVersion version) {
            return new VersionSummary(version.getId(), version.getRevision(), version.getTitle(), version.getCreatedAt(), version.getEditorUserId(), version.getReason());
        }
    }
    public record DocumentResponse(String id, String title, String content, long createdAt, long updatedAt,
            String parentId, boolean favorite, Long deletedAt, String workspaceId, String ownerId,
            String contentFormat, int formatVersion, Map<String,Object> contentJson, String icon, String coverRef,
            boolean archived, long sortOrder, long lastEditedAt, long revision, long rowVersion) {}

    public record WhatsAppShareResponse(String shareUrl) {
    }

    private DocumentOwner resolveOwner(AppUserDetails principal, HttpSession session) {
        return principal == null
                ? DocumentOwner.guest(guestSessionService.getOrCreateGuestId(session))
                : DocumentOwner.user(principal.userId());
    }

    private DocumentResponse toResponse(Document document) {
        return new DocumentResponse(
                document.getId(),
                document.getTitle(),
                document.getContent(),
                document.getCreatedAt(),
                document.getUpdatedAt(),
                document.getParentId(),
                document.isFavorite(),
                document.getDeletedAt(), document.getWorkspaceId(),
                document.getOwnerUser() == null ? null : document.getOwnerUser().getId(),
                document.getContentFormat(), document.getFormatVersion(), document.getContentJson(), document.getIcon(), document.getCoverRef(),
                document.isArchived(), document.getSortOrder(), document.getLastEditedAt(), document.getRevision(), document.getRowVersion());
    }
}
