package com.squareone.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.squareone.model.AppUser;
import com.squareone.model.Document;
import com.squareone.repository.AppUserRepository;
import com.squareone.repository.DocumentRepository;

@Service
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final AppUserRepository appUserRepository;

    public DocumentService(DocumentRepository documentRepository, AppUserRepository appUserRepository) {
        this.documentRepository = documentRepository;
        this.appUserRepository = appUserRepository;
    }

    public Document createDocument(DocumentOwner owner) {
        Document document = new Document();
        if (owner.userId() != null) {
            AppUser user = appUserRepository.findById(owner.userId())
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
            document.setOwnerUser(user);
        } else {
            document.setGuestId(owner.guestId());
        }
        return documentRepository.save(document);
    }

    public List<Document> getAllDocuments(DocumentOwner owner) {
        return owner.userId() != null
                ? documentRepository.findAllByOwnerUser_IdOrderByUpdatedAtDesc(owner.userId())
                : documentRepository.findAllByGuestIdOrderByUpdatedAtDesc(owner.guestId());
    }

    public Document getDocument(String id, DocumentOwner owner) {
        return findOwnedDocument(id, owner)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));
    }

    public Document updateDocument(String id, DocumentOwner owner, String title, String content) {
        Document document = getDocument(id, owner);

        document.setTitle(title);
        document.setContent(content);
        document.setUpdatedAt(System.currentTimeMillis());

        return documentRepository.save(document);
    }

    public void deleteDocument(String id, DocumentOwner owner) {
        documentRepository.delete(getDocument(id, owner));
    }

    @Transactional
    public int transferGuestDocuments(String guestId, AppUser owner) {
        if (guestId == null || guestId.isBlank()) {
            return 0;
        }
        return documentRepository.transferGuestDocuments(guestId, owner);
    }

    private java.util.Optional<Document> findOwnedDocument(String id, DocumentOwner owner) {
        return owner.userId() != null
                ? documentRepository.findByIdAndOwnerUser_Id(id, owner.userId())
                : documentRepository.findByIdAndGuestId(id, owner.guestId());
    }
}
