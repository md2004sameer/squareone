package com.squareone.service;

import java.util.HashMap;
import java.util.List;

import org.springframework.stereotype.Service;

import com.squareone.model.Document;

@Service
public class DocumentService {

    private final HashMap<String, Document> documents = new HashMap<>();

    public Document createDocument() {
        Document document = new Document();
        documents.put(document.getId(), document);
        return document;
    }

    public List<Document> getAllDocuments() {
        return List.copyOf(documents.values());
    }

    public Document getDocument(String id) {
        Document document = documents.get(id);

        if (document == null) {
            throw new IllegalArgumentException("Document not found: " + id);
        }
        return document;
    }

    public Document updateDocument(String id, String title, String content) {
        Document document = getDocument(id);

        document.setTitle(title);
        document.setContent(content);
        document.setUpdatedAt(System.currentTimeMillis());

        return document;
    }

    public void deleteDocument(String id) {
        if (documents.remove(id) == null) {
            throw new IllegalArgumentException("Document not found: " + id);
        }
    }
}
