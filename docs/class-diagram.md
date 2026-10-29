# SquareOne — Class Diagram

This diagram documents the current backend classes in `src/main/java/com/squareone`.

## Render the diagram

- **GitHub:** open this file; GitHub renders the Mermaid block automatically.
- **VS Code:** open this Markdown file, then press `Cmd+Shift+V` to preview or `Cmd+K V` to preview beside the source on macOS. On Windows/Linux, use `Ctrl+Shift+V` or `Ctrl+K V`.

```mermaid
classDiagram
direction TB

class SquareoneApplication {
  +main(args) void
}

class DocumentController {
  -DocumentService documentService
  -DocumentExportService documentExportService
  -WhatsAppShareService whatsAppShareService
  +createDocument() ResponseEntity
  +health() String
  +getAllDocuments() List~Document~
  +getDocument(id) Document
  +updateDocument(id, request) Document
  +deleteDocument(id) ResponseEntity
  +exportDocument(id, format) ResponseEntity
  +createWhatsAppShare(id) WhatsAppShareResponse
  +handleDocumentNotFound() ResponseEntity
}

class DocumentRequest {
  <<record>>
  +String title
  +String content
}

class WhatsAppShareResponse {
  <<record>>
  +String shareUrl
}

class Document {
  <<JPA Entity>>
  -String id
  -String title
  -String content
  -long createdAt
  -long updatedAt
  +Document()
  +getId() String
  +setId(id) void
  +getTitle() String
  +setTitle(title) void
  +getContent() String
  +setContent(content) void
  +getCreatedAt() long
  +setCreatedAt(time) void
  +getUpdatedAt() long
  +setUpdatedAt(time) void
}

class DocumentRepository {
  <<interface>>
}

class JpaRepository {
  <<Spring Data JPA>>
}

class DocumentService {
  -DocumentRepository documentRepository
  +createDocument() Document
  +getAllDocuments() List~Document~
  +getDocument(id) Document
  +updateDocument(id, title, content) Document
  +deleteDocument(id) void
}

class DocumentExportService {
  -DocumentService documentService
  -Map~String, DocumentExporter~ exporters
  +export(documentId, format) ExportedDocument
}

class ExportedDocument {
  <<record>>
  +String filename
  +String contentType
  +byte[] content
}

class WhatsAppShareService {
  -DocumentService documentService
  +createShareUrl(documentId) String
}

class DocumentExporter {
  <<interface>>
  +format() String
  +contentType() String
  +fileExtension() String
  +export(document) byte[]
}

class PdfDocumentExporter {
  +format() String
  +contentType() String
  +fileExtension() String
  +export(document) byte[]
  -createPages(document) List
  -createPdfObjects(pages) List
  -writePdf(objects) byte[]
  -wrapText(text, maxLength) List
  -pdfText(text) String
  -escapePdfText(text) String
}

class PlainTextDocumentExporter {
  +format() String
  +contentType() String
  +fileExtension() String
  +export(document) byte[]
}

class WordDocumentExporter {
  +format() String
  +contentType() String
  +fileExtension() String
  +export(document) byte[]
  -documentXml(document) String
  -stylesXml() String
  -contentTypesXml() String
  -packageRelationshipsXml() String
  -documentRelationshipsXml() String
  -xmlEscape(text) String
  -addEntry(zip, path, contents) void
}

DocumentRepository ..|> JpaRepository : extends Spring Data JPA
DocumentService --> DocumentRepository : persistence
DocumentService ..> Document : creates and updates
DocumentController --> DocumentService : document operations
DocumentController --> DocumentExportService : export endpoint
DocumentController --> WhatsAppShareService : sharing endpoint
DocumentController ..> DocumentRequest : accepts
DocumentController ..> WhatsAppShareResponse : returns
DocumentController ..> Document : response body
DocumentExportService --> DocumentService : loads document
DocumentExportService --> DocumentExporter : discovers and selects exporter
DocumentExportService ..> ExportedDocument : returns
WhatsAppShareService --> DocumentService : loads document
DocumentExporter ..> Document : exports
PdfDocumentExporter ..|> DocumentExporter
PlainTextDocumentExporter ..|> DocumentExporter
WordDocumentExporter ..|> DocumentExporter
```

## Main relationships

- `DocumentController` handles HTTP requests and delegates work to services.
- `DocumentService` performs CRUD operations through `DocumentRepository`.
- `Document` is the JPA entity persisted in the database.
- `DocumentExportService` selects an exporter by format (`pdf`, `txt`, or `docx`).
- The three exporter classes implement `DocumentExporter`, which is the Strategy pattern.
- `WhatsAppShareService` builds a WhatsApp share URL from the document title and content.

The diagram reflects the repository's current `main` branch. Update it when class responsibilities or relationships change.
