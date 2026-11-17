# Persistence audit and implementation

The application is Spring Boot 4 / Java 21, Spring Data JPA, Spring Security, and a vanilla JavaScript frontend. Tiptap serializes rich text as HTML. PostgreSQL (Neon) is configured in the ignored local `.env`, using the `squareone` schema; H2 is used only by explicitly configured tests; normal application startup requires database credentials and has no automatic local fallback.

Existing tables are `app_users` and `documents`. Accounts use BCrypt; guest ownership uses a UUID stored in the HTTP session. Signing in transfers guest documents and Trash to the account. CRUD, hierarchy, favorites, duplication, Trash, restore, exports, and WhatsApp sharing already use owner-scoped backend APIs. Export and share flows read the saved HTML and derive their output without changing stored content.

Before this change, schema changes used Hibernate `update`; sessions lived in memory; theme, sidebar, page width, document sorting and collapsed branches were localStorage-only. Focus mode was transient. Documents lacked explicit workspaces, stable manual ordering, archive/appearance metadata, concurrency checks and historical versions. User profile edits were persisted but had no update timestamp or provider/status fields. There was no React or sessionStorage state.

The implementation extends the existing identifiers and APIs. Existing HTML remains the compatible content representation, with optional Tiptap JSON stored alongside it as JSONB on PostgreSQL. Authenticated preferences are authoritative in the database. Guest caches remain browser-scoped. Version snapshots are immutable checkpoints, not a full snapshot on every keystroke. Every workspace access is checked against the current account or guest identity.

## Release behavior

Flyway applies three vendor-specific migrations; Hibernate only validates. Adoption supports the original schema without organization columns and PostgreSQL OID-backed bodies. Pre-Flyway databases need a backup and an explicit baseline at version 0 before their first upgraded start. See [production deployment](production.md).

JDBC HTTP sessions persist both guest identity and authenticated security context. Password hashes are transient and are not serialized into sessions. Disabled accounts invalidate their active session on API access. Server cookies last 14 days; browser draft recovery copies expire after 30 days.

Document content writes carry a revision and return HTTP 409 when stale. The browser preserves the pending draft and offers a recovered copy or the current server version. Organization and appearance use row versions. Workspace locks serialize hierarchy changes and guest transfers; ownership is checked again after acquiring a lock. Version restore creates a new revision and retains the state being replaced.

Archive, history previews/restoration, icons and cover images are connected to the workspace UI. Registered writing preferences sync to the backend; guests retain browser-scoped settings. The bundled editor uses patched Tiptap 3 and is rebuilt from the lockfile during Docker packaging.

Release checks cover legacy migration, backend authorization/exports/organization, browser recovery and editing, and real HTTP session recovery after stopping and restarting the packaged application. CI runs persistence checks on H2 and PostgreSQL.

## Neon as the primary store

The default application profile and Docker image require the Neon/PostgreSQL connection settings. The default schema is `squareone`. Login uses the JPA account repository to load the account and BCrypt hash from that database; signup and profile/password updates use the same transactional datasource. Workspaces, document content and metadata, history, registered-user preferences and JDBC sessions all share it. Browser localStorage contains recovery drafts and preference caches, never passwords or Neon connection credentials.

Automated H2 checks supply the `h2-test` profile, their datasource and `PUBLIC` schema explicitly. Normal startup rejects H2, and production rejects it even with the test profile active, keeping real accounts and authentication sessions on PostgreSQL. The Docker image no longer sets an H2 URL, and Compose requires the ignored `.env`. Existing local database files are not deleted or imported automatically.
