package com.squareone.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.squareone.model.Document;
import com.squareone.repository.DocumentRepository;

@Service
public class DocumentService {

    private final DocumentRepository documentRepository;

    public DocumentService(DocumentRepository documentRepository) {
        this.documentRepository = documentRepository;
    }

    public Document createDocument() {
        Document document = new Document();
        return documentRepository.save(document);
    }

    public List<Document> getAllDocuments() {
        return documentRepository.findAll();
    }

    public Document getDocument(String id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));
    }

    public Document updateDocument(String id, String title, String content) {
        Document document = getDocument(id);

        document.setTitle(title);
        document.setContent(content);
        document.setUpdatedAt(System.currentTimeMillis());

        return documentRepository.save(document);
    }

    public void deleteDocument(String id) {
        if (!documentRepository.existsById(id)) {
            throw new IllegalArgumentException("Document not found: " + id);
        }
        documentRepository.deleteById(id);
    }
}
