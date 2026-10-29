# SquareOne — Architecture Diagram

This diagram reflects the current `main` branch. It shows the browser UI, Spring Boot backend, persistence, export strategies, and sharing flow.

## System architecture

```mermaid
flowchart TB
    User([User])

    subgraph Browser["Browser"]
        UI["index.html<br/>Editor UI"]
        CSS["stylesdocs.css<br/>Presentation"]
        JS["appdocs.js<br/>Editor logic + API calls"]
        Cache[("Browser local document cache<br/>30-day expiry")]
        UI --- CSS
        UI --> JS
        JS <--> Cache
    end

    subgraph App["SquareOne Spring Boot application"]
        AppMain["SquareoneApplication"]
        Controller["DocumentController<br/>REST: /api/documents"]
        DocService["DocumentService<br/>CRUD + validation"]
        ExportService["DocumentExportService<br/>format selection"]
        ShareService["WhatsAppShareService<br/>share URL generation"]
        Model["Document<br/>JPA entity"]
        Repo["DocumentRepository<br/>Spring Data JPA"]
        Exporter["DocumentExporter<br/>strategy interface"]
        PDF["PdfDocumentExporter"]
        TXT["PlainTextDocumentExporter"]
        DOCX["WordDocumentExporter"]

        AppMain --> Controller
        Controller --> DocService
        Controller --> ExportService
        Controller --> ShareService
        DocService --> Repo
        DocService --> Model
        ExportService --> DocService
        ExportService --> Exporter
        Exporter --> PDF
        Exporter --> TXT
        Exporter --> DOCX
        ShareService --> DocService
    end

    DB[("H2 database<br/>./data/squareone")]
    Volume[("Docker named volume<br/>squareone-data")]

    User --> UI
    JS <-->|HTTP/JSON| Controller
    Repo --> DB
    DB --- Volume
    ExportService -->|PDF / TXT / DOCX bytes| Controller
    ShareService -->|WhatsApp share URL| Controller
    Controller -->|share link opens| WhatsApp["WhatsApp web/app"]

    classDef browser fill:#eaf2ff,stroke:#4c78a8,color:#172b4d
    classDef backend fill:#eaf7ef,stroke:#39845a,color:#153b25
    classDef storage fill:#fff3dc,stroke:#b7791f,color:#55370c
    classDef external fill:#f4eaff,stroke:#8b5fbf,color:#38204f
    class UI,CSS,JS,Cache browser
    class AppMain,Controller,DocService,ExportService,ShareService,Model,Repo,Exporter,PDF,TXT,DOCX backend
    class DB,Volume storage
    class WhatsApp external
```

## Main request flows

### Create, read, update, and delete documents

```mermaid
sequenceDiagram
    actor User
    participant UI as Browser UI (appdocs.js)
    participant API as DocumentController
    participant Service as DocumentService
    participant Repo as DocumentRepository
    participant DB as H2 database

    User->>UI: Edit or manage document
    UI->>API: HTTP request /api/documents
    API->>Service: Invoke CRUD operation
    Service->>Repo: Save, find, or delete
    Repo->>DB: JPA operation
    DB-->>Repo: Persisted data / result
    Repo-->>Service: Document / result
    Service-->>API: Return result
    API-->>UI: HTTP response
    UI->>UI: Refresh browser-local copy
```

### Export and WhatsApp sharing

```mermaid
flowchart LR
    Request["Export or share request"] --> Controller["DocumentController"]
    Controller --> Export["DocumentExportService"]
    Export --> Load["DocumentService loads document"]
    Export --> Select{"Format"}
    Select -->|pdf| PDF["PdfDocumentExporter"]
    Select -->|txt| TXT["PlainTextDocumentExporter"]
    Select -->|docx| DOCX["WordDocumentExporter"]
    PDF --> Download["Controller returns downloadable bytes"]
    TXT --> Download
    DOCX --> Download

    Controller --> Share["WhatsAppShareService"]
    Share --> Load
    Share --> URL["Build encoded wa.me share URL"]
    URL --> WhatsApp["User opens WhatsApp to send"]
```

## Responsibilities

| Component | Responsibility |
|---|---|
| `index.html`, `stylesdocs.css`, `appdocs.js` | Browser editor, styling, API calls, and local recovery cache |
| `DocumentController` | HTTP endpoints and response construction |
| `DocumentService` | Document CRUD operations |
| `DocumentRepository` | JPA persistence interface |
| `Document` | Document entity: ID, title, content, creation and update timestamps |
| `DocumentExportService` | Selects an exporter based on the requested format |
| `DocumentExporter` and implementations | Strategy pattern for PDF, plain text, and Word export |
| `WhatsAppShareService` | Creates a WhatsApp URL containing the document text |
| H2 | Primary persistent document store |
| Browser local cache | Temporary per-browser recovery copy; H2 remains the primary store |

## Important deployment note

The current application has no authentication or per-user document separation. Anyone who can reach the instance can access the shared document collection. The Docker Compose setup persists H2 data using the `squareone-data` named volume.

## View the diagrams

- **GitHub:** open this Markdown file; Mermaid diagrams render automatically.
- **VS Code:** open the file and press `Cmd+Shift+V` (macOS) or `Ctrl+Shift+V` (Windows/Linux). Use `Cmd+K V` / `Ctrl+K V` to preview beside the source.
