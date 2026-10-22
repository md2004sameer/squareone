package com.squareone.controller;

import java.net.URI;
import java.util.List;

import org.springframework.http.HttpStatus;
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
import com.squareone.service.DocumentService;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @PostMapping
    public ResponseEntity<Document> createDocument() {
        Document document = documentService.createDocument();
        URI location = URI.create("/api/documents/" + document.getId());
        return ResponseEntity.created(location).body(document);
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

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Void> handleDocumentNotFound() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    public record DocumentRequest(String title, String content) {
    }
}
