ALTER TABLE ${appSchema}.app_users ADD COLUMN IF NOT EXISTS updated_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE ${appSchema}.app_users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(32) NOT NULL DEFAULT 'PASSWORD';
ALTER TABLE ${appSchema}.app_users ADD COLUMN IF NOT EXISTS account_status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE ${appSchema}.app_users ADD COLUMN IF NOT EXISTS avatar_ref VARCHAR(2048);
UPDATE ${appSchema}.app_users SET updated_at = created_at WHERE updated_at = 0;

CREATE TABLE ${appSchema}.workspaces (
    id VARCHAR(36) PRIMARY KEY, name VARCHAR(160) NOT NULL, description VARCHAR(2000) NOT NULL DEFAULT '',
    owner_user_id VARCHAR(36), guest_id VARCHAR(36) UNIQUE, default_for_user_id VARCHAR(36) UNIQUE,
    created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
    CONSTRAINT fk_workspace_user FOREIGN KEY (owner_user_id) REFERENCES ${appSchema}.app_users(id),
    CONSTRAINT fk_default_workspace_user FOREIGN KEY (default_for_user_id) REFERENCES ${appSchema}.app_users(id),
    CONSTRAINT ck_workspace_identity CHECK ((owner_user_id IS NOT NULL AND guest_id IS NULL) OR (owner_user_id IS NULL AND guest_id IS NOT NULL)),
    CONSTRAINT ck_default_workspace_owner CHECK (default_for_user_id IS NULL OR default_for_user_id = owner_user_id),
    CONSTRAINT uq_workspace_owner UNIQUE (id, owner_user_id),
    CONSTRAINT uq_workspace_guest UNIQUE (id, guest_id)
);
INSERT INTO ${appSchema}.workspaces (id, name, owner_user_id, default_for_user_id, created_at, updated_at)
    SELECT id, 'My workspace', id, id, created_at, updated_at FROM ${appSchema}.app_users;
INSERT INTO ${appSchema}.workspaces (id, name, guest_id, created_at, updated_at)
    SELECT guest_id, 'Guest workspace', guest_id, MIN(created_at), MAX(updated_at)
    FROM ${appSchema}.documents WHERE guest_id IS NOT NULL AND owner_user_id IS NULL GROUP BY guest_id;

ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(36);
ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS content_format VARCHAR(40) NOT NULL DEFAULT 'tiptap-html';
ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS format_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS content_json JSONB;
ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS icon VARCHAR(32);
ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS cover_ref VARCHAR(2048);
ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS sort_order BIGINT NOT NULL DEFAULT 0;
ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS last_edited_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS row_version BIGINT NOT NULL DEFAULT 0;
UPDATE ${appSchema}.documents SET workspace_id = COALESCE(owner_user_id, guest_id);
UPDATE ${appSchema}.documents SET sort_order = created_at, last_edited_at = updated_at;
-- Keep unassigned legacy rows private; detach invalid legacy parent references.
UPDATE ${appSchema}.documents d SET parent_id = NULL WHERE parent_id IS NOT NULL AND
    (parent_id = id OR NOT EXISTS (SELECT 1 FROM ${appSchema}.documents p WHERE p.id = d.parent_id AND p.workspace_id = d.workspace_id));
ALTER TABLE ${appSchema}.documents ADD CONSTRAINT fk_document_workspace FOREIGN KEY (workspace_id) REFERENCES ${appSchema}.workspaces(id);
ALTER TABLE ${appSchema}.documents ADD CONSTRAINT uq_document_workspace UNIQUE (id, workspace_id);
ALTER TABLE ${appSchema}.documents ADD CONSTRAINT fk_document_parent_workspace FOREIGN KEY (parent_id, workspace_id) REFERENCES ${appSchema}.documents(id, workspace_id);
ALTER TABLE ${appSchema}.documents ADD CONSTRAINT ck_document_parent CHECK (parent_id IS NULL OR parent_id <> id);
ALTER TABLE ${appSchema}.documents ADD CONSTRAINT ck_document_identity CHECK (owner_user_id IS NULL OR guest_id IS NULL);
ALTER TABLE ${appSchema}.documents ADD CONSTRAINT fk_document_workspace_owner FOREIGN KEY (workspace_id, owner_user_id) REFERENCES ${appSchema}.workspaces(id, owner_user_id);
ALTER TABLE ${appSchema}.documents ADD CONSTRAINT fk_document_workspace_guest FOREIGN KEY (workspace_id, guest_id) REFERENCES ${appSchema}.workspaces(id, guest_id);
CREATE INDEX ix_document_workspace_active ON ${appSchema}.documents(workspace_id, deleted_at, archived, updated_at);
CREATE INDEX ix_document_parent_order ON ${appSchema}.documents(workspace_id, parent_id, sort_order);

CREATE TABLE ${appSchema}.user_preferences (
    user_id VARCHAR(36) PRIMARY KEY, theme VARCHAR(16) NOT NULL DEFAULT 'system',
    sidebar_mode VARCHAR(16) NOT NULL DEFAULT 'expanded', sidebar_width INTEGER NOT NULL DEFAULT 260,
    wide_page BOOLEAN NOT NULL DEFAULT FALSE, focus_mode BOOLEAN NOT NULL DEFAULT FALSE,
    font_family VARCHAR(16) NOT NULL DEFAULT 'sans', font_size INTEGER NOT NULL DEFAULT 18,
    line_height DOUBLE PRECISION NOT NULL DEFAULT 1.75, document_sort VARCHAR(16) NOT NULL DEFAULT 'updated',
    collapsed_document_ids JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at BIGINT NOT NULL,
    CONSTRAINT fk_preferences_user FOREIGN KEY (user_id) REFERENCES ${appSchema}.app_users(id) ON DELETE CASCADE,
    CONSTRAINT ck_preference_theme CHECK (theme IN ('system','light','dark')),
    CONSTRAINT ck_preference_sidebar CHECK (sidebar_mode IN ('expanded','compact','hidden')),
    CONSTRAINT ck_preference_sort CHECK (document_sort IN ('updated','created','title','manual')),
    CONSTRAINT ck_preference_font CHECK (font_family IN ('sans','serif','mono')),
    CONSTRAINT ck_preference_width CHECK (sidebar_width BETWEEN 220 AND 400),
    CONSTRAINT ck_preference_size CHECK (font_size BETWEEN 12 AND 32),
    CONSTRAINT ck_preference_line_height CHECK (line_height BETWEEN 1.2 AND 2.5)
);
INSERT INTO ${appSchema}.user_preferences (user_id, updated_at) SELECT id, updated_at FROM ${appSchema}.app_users;
CREATE TABLE ${appSchema}.document_versions (
    id VARCHAR(36) PRIMARY KEY, document_id VARCHAR(36) NOT NULL, revision BIGINT NOT NULL,
    title VARCHAR(160) NOT NULL, content TEXT NOT NULL, content_json JSONB,
    content_format VARCHAR(40) NOT NULL, format_version INTEGER NOT NULL,
    created_at BIGINT NOT NULL, editor_user_id VARCHAR(36), reason VARCHAR(32) NOT NULL,
    CONSTRAINT fk_version_document FOREIGN KEY (document_id) REFERENCES ${appSchema}.documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_version_editor FOREIGN KEY (editor_user_id) REFERENCES ${appSchema}.app_users(id),
    CONSTRAINT uq_document_revision UNIQUE (document_id, revision)
);
INSERT INTO ${appSchema}.document_versions (id,document_id,revision,title,content,content_format,format_version,created_at,editor_user_id,reason)
    SELECT id,id,revision,title,content,content_format,format_version,updated_at,owner_user_id,'imported' FROM ${appSchema}.documents;
CREATE INDEX ix_version_document_created ON ${appSchema}.document_versions(document_id, created_at);
CREATE UNIQUE INDEX uq_user_email_normalized ON ${appSchema}.app_users(LOWER(email));
