package com.squareone.controller;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;

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

    public DocumentController(
            DocumentService documentService,
            DocumentExportService documentExportService,
            WhatsAppShareService whatsAppShareService,
            GuestSessionService guestSessionService) {
        this.documentService = documentService;
        this.documentExportService = documentExportService;
        this.whatsAppShareService = whatsAppShareService;
        this.guestSessionService = guestSessionService;
    }

    @PostMapping
    public ResponseEntity<DocumentResponse> createDocument(
            @AuthenticationPrincipal AppUserDetails principal,
            HttpSession session) {
        Document document = documentService.createDocument(resolveOwner(principal, session));
        URI location = URI.create("/api/documents/" + document.getId());
        return ResponseEntity.created(location).body(toResponse(document));
    }

    @GetMapping("/health")
    public String health() {
        return "OK";
    }

    @GetMapping
    public List<DocumentResponse> getAllDocuments(
            @AuthenticationPrincipal AppUserDetails principal,
            HttpSession session) {
        return documentService.getAllDocuments(resolveOwner(principal, session)).stream()
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

    @PutMapping("/{id}")
    public DocumentResponse updateDocument(
            @PathVariable String id,
            @RequestBody DocumentRequest request,
            @AuthenticationPrincipal AppUserDetails principal,
            HttpSession session) {
        return toResponse(documentService.updateDocument(
                id, resolveOwner(principal, session), request.title(), request.content()));
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

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Void> handleDocumentNotFound() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    public record DocumentRequest(String title, String content) {
    }

    public record DocumentResponse(String id, String title, String content, long createdAt, long updatedAt) {
    }

    public record WhatsAppShareResponse(String shareUrl) {
    }

    private DocumentOwner resolveOwner(AppUserDetails principal, HttpSession session) {
        return principal == null
                ? DocumentOwner.guest(guestSessionService.getOrCreateGuestId(session))
                : DocumentOwner.user(principal.user().getId());
    }

    private DocumentResponse toResponse(Document document) {
        return new DocumentResponse(
                document.getId(),
                document.getTitle(),
                document.getContent(),
                document.getCreatedAt(),
                document.getUpdatedAt());
    }
}
