CREATE TABLE IF NOT EXISTS ${appSchema}.app_users (
    id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(100) NOT NULL,
    avatar_color VARCHAR(7) NOT NULL, created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS ${appSchema}.documents (
    id VARCHAR(36) PRIMARY KEY, title VARCHAR(160) NOT NULL, content TEXT NOT NULL,
    created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
    parent_id VARCHAR(36), favorite BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at BIGINT, owner_user_id VARCHAR(36), guest_id VARCHAR(36),
    CONSTRAINT fk_document_owner FOREIGN KEY (owner_user_id) REFERENCES ${appSchema}.app_users(id)
);
ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS parent_id VARCHAR(36);
ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ${appSchema}.documents ADD COLUMN IF NOT EXISTS deleted_at BIGINT;
ALTER TABLE ${appSchema}.documents ALTER COLUMN content TEXT NOT NULL;
