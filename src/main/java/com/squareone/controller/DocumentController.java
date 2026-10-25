package com.squareone.controller;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;

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
import com.squareone.service.DocumentExportService;
import com.squareone.service.DocumentService;
import com.squareone.service.WhatsAppShareService;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;
    private final DocumentExportService documentExportService;
    private final WhatsAppShareService whatsAppShareService;

    public DocumentController(
            DocumentService documentService,
            DocumentExportService documentExportService,
            WhatsAppShareService whatsAppShareService) {
        this.documentService = documentService;
        this.documentExportService = documentExportService;
        this.whatsAppShareService = whatsAppShareService;
    }

    @PostMapping
    public ResponseEntity<Document> createDocument() {
        Document document = documentService.createDocument();
        URI location = URI.create("/api/documents/" + document.getId());
        return ResponseEntity.created(location).body(document);
    }
    @GetMapping("/health")
    public String health() {
    return "OK";
    }

    @GetMapping
    public List<Document> getAllDocuments() {
        return documentService.getAllDocuments();
    }

    @GetMapping("/{id}")
    public Document getDocument(@PathVariable String id) {
        return documentService.getDocument(id);
    }

    @PutMapping("/{id}")
    public Document updateDocument(
            @PathVariable String id,
            @RequestBody DocumentRequest request) {
        return documentService.updateDocument(id, request.title(), request.content());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable String id) {
        documentService.deleteDocument(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/export/{format}")
    public ResponseEntity<byte[]> exportDocument(
            @PathVariable String id,
            @PathVariable String format) throws IOException {
        DocumentExportService.ExportedDocument exported = documentExportService.export(id, format);
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
    public WhatsAppShareResponse createWhatsAppShare(@PathVariable String id) {
        return new WhatsAppShareResponse(whatsAppShareService.createShareUrl(id));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Void> handleDocumentNotFound() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    public record DocumentRequest(String title, String content) {
    }

    public record WhatsAppShareResponse(String shareUrl) {
    }
}
