# Editor redesign implementation plan

Use the supplied written visual targets; no reference screenshot was attached. Extend the existing Spring Boot, JavaScript-module and Tiptap editor. Preserve workspace navigation, account ownership, autosave, drafts, revision/conflict recovery and the recently fixed Back navigation.

1. [x] Audit editor, themes, preferences, scrolling and HTML/JSON/export compatibility; establish the shared command and positioning boundaries.
2. [x] Implement neutral dark surfaces and consistent theme tokens, centered normal/wide canvases, a wrapping title, comfortable typography and visible focus-mode save/recovery controls.
3. [x] Consolidate command definitions; implement the compact slash menu, context rules, keyboard/pointer/touch handling, composition protection and viewport-aware positioning.
4. [x] Add a functional bottom toolbar plus persistent collapsible blocks, local-calendar dates and HTTPS body images with accessible failure states and document-scoped insertion.
5. [x] Integrate selection formatting, table/block controls, pane/keyboard resizing and content/export fallbacks; visually inspect desktop and narrow touch layouts.
6. [x] Add focused browser/backend coverage, rebuild the local editor bundle and notices, run the existing checks, and prepare the completed change for the existing service's automatic deployment of main.

## Verification requirements

- Existing notes and preferences remain unchanged on opening; typing does not reset selection or undo history.
- Long titles wrap and grow after typing, loading, resizing and preference changes; Enter moves to the body.
- Slash and toolbar insertion use the same commands; menus remain inside the workspace/visual viewport and support IME, keyboard and touch.
- Dropdown content/open state, dates and images survive HTML loading, JSON saving, duplication, history restore and local recovery.
- Previews, search, counts and exports contain readable dropdown and image fallbacks, without server-side image fetching.
- Tables, whole-block movement, undo/redo, normal/wide/focus modes and browser Back/Forward keep working.
- Floating controls clear content and the mobile keyboard, and hide behind dialogs/navigation drawers.
- Light, dark and system themes and saved writing/sidebar preferences remain functional.

Update this checklist and record the actual verification results as each step is completed.

## Implementation and verification

- The shared registry now drives slash, bottom-toolbar and block-add insertion. Exact aliases take priority over fuzzy matches; unsupported commands preserve content, and date/image dialogs retain their originating document and selection.
- Collapsible blocks use the existing HTML load path and JSON save path. Their open state persists. Images keep an accessible load-failure placeholder, and previews/search/TXT/PDF/DOCX include readable image and nested-content fallbacks.
- Mouse and touch use the existing pointer-based block movement controller. Block moves form a separate undo step. Writing-settings dialogs restore the original editor selection without rebuilding the editor.
- `npm run test:ui`: **51 passed**, including the original workspace suite plus 20 redesign scenarios. Coverage includes mouse/touch/keyboard controls, table resizing, selection formatting, history restore, offline recovery, sidebar/focus/wide layouts, theme and writing preferences, and browser Back/Forward.
- `./gradlew test bootJar`: **30 tests passed** and the deployable jar built successfully. The editor bundle and generated notices were rebuilt with `npm run build:editor`; `git diff --check` passed.
- `npm run test:persistence` passed against a fresh temporary H2 database and a separate temporary PostgreSQL database with the production profile. Accounts, JDBC sessions, rich HTML/JSON, disclosure state, preferences and readable exports survive process restart. No live database was used for these automated tests.
- Visually inspected dark desktop (1440px), focus mode and narrow mobile (390px), with automated gutter/viewport checks at 320px, 390px and 760px and workspace-width checks at 1800px. No screenshot was supplied, so visual comparison uses the written targets.
- The separate live release check verifies asset version 31, a temporary guest note containing a dropdown/date/image, save/reload/export, wide-page layout, and mobile focus-mode Back navigation. It deletes its own note and records the result in the ignored `data/backups/live-editor-redesign-verification.json` after the existing Render service finishes deploying main.

## Remaining phase boundaries

Mobile keyboard geometry is tested with visual-viewport emulation; a physical iOS/Android keyboard was not available. Images use HTTPS links, with no upload service or server-side image fetching. Sharing, chat, AI and collaboration remain outside this editor phase.
