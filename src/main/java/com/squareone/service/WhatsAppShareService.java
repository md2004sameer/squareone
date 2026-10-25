package com.squareone.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.springframework.stereotype.Service;

import com.squareone.model.Document;

@Service
public class WhatsAppShareService {

    private final DocumentService documentService;

    public WhatsAppShareService(DocumentService documentService) {
        this.documentService = documentService;
    }

    public String createShareUrl(String documentId) {
        Document document = documentService.getDocument(documentId);
        String message = document.getTitle() + "\n\n" + document.getContent();
        return "https://wa.me/?text=" + URLEncoder.encode(message, StandardCharsets.UTF_8);
    }
}
