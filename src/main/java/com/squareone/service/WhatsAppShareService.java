package com.squareone.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.springframework.stereotype.Service;

import com.squareone.model.Document;
import com.squareone.util.DocumentContentText;

@Service
public class WhatsAppShareService {

    private final DocumentService documentService;

    public WhatsAppShareService(DocumentService documentService) {
        this.documentService = documentService;
    }

    public String createShareUrl(String documentId, DocumentOwner owner) {
        Document document = documentService.getDocument(documentId, owner);
        String message = document.getTitle() + "\n\n" + DocumentContentText.toPlainText(document.getContent());
        return "https://wa.me/?text=" + URLEncoder.encode(message, StandardCharsets.UTF_8);
    }
}
