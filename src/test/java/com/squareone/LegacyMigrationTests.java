package com.squareone;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class LegacyMigrationTests {
    @Test
    void adoptsOriginalSchemaWithoutLosingContentOrExposingUnownedNotes() throws Exception {
        String url = System.getenv().getOrDefault("SQUAREONE_TEST_DATABASE_URL", "jdbc:h2:mem:legacy-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
        boolean postgres = url.startsWith("jdbc:postgresql:");
        String username = System.getenv().getOrDefault("SQUAREONE_TEST_DATABASE_USERNAME", "sa");
        String password = System.getenv().getOrDefault("SQUAREONE_TEST_DATABASE_PASSWORD", "");
        String schema = postgres ? "legacy_" + UUID.randomUUID().toString().replace("-", "") : "PUBLIC";
        try (var connection = DriverManager.getConnection(url, username, password); var sql = connection.createStatement()) {
            if (postgres) { sql.execute("CREATE SCHEMA IF NOT EXISTS " + schema); sql.execute("SET search_path TO " + schema); }
            sql.execute("CREATE TABLE app_users (id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(100) NOT NULL, avatar_color VARCHAR(7) NOT NULL, created_at BIGINT NOT NULL)");
            sql.execute("CREATE TABLE documents (id VARCHAR(36) PRIMARY KEY, title VARCHAR(160) NOT NULL, content " + (postgres ? "OID" : "CLOB") + " NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, owner_user_id VARCHAR(36), guest_id VARCHAR(36))");
            sql.execute("INSERT INTO app_users VALUES ('owner', 'Owner', 'owner@example.test', 'hash', '#617459', 100)");
            String insert = "INSERT INTO documents VALUES (?, ?, " + (postgres ? "lo_from_bytea(0, convert_to(?, 'UTF8'))" : "?") + ", 100, 200, ?, ?)";
            try (var row = connection.prepareStatement(insert)) {
                String[][] notes = {
                    {"owned", "Account note", "<p>Keep Ω and हिन्दी</p>", "owner", null},
                    {"guest-note", "Guest note", "<p>Guest body</p>", null, "guest"},
                    {"legacy", "Private legacy", "Unassigned", null, null}
                };
                for (String[] note : notes) {
                    for (int index = 0; index < note.length; index++) row.setString(index + 1, note[index]);
                    row.executeUpdate();
                }
            }
        }
        var flyway = Flyway.configure().dataSource(url, username, password).locations("classpath:db/migration/" + (postgres ? "postgresql" : "h2"))
                .defaultSchema(schema).schemas(schema).placeholders(Map.of("appSchema", schema))
                .baselineOnMigrate(true).baselineVersion("0").load();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(3);
        flyway.validate();
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        try (var connection = DriverManager.getConnection(url, username, password); var sql = connection.createStatement()) {
            if (postgres) { sql.execute("CREATE SCHEMA IF NOT EXISTS " + schema); sql.execute("SET search_path TO " + schema); }
            try (var rows = sql.executeQuery("SELECT content, workspace_id, revision, favorite FROM documents WHERE id='owned'")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getString(1)).isEqualTo("<p>Keep Ω and हिन्दी</p>");
                assertThat(rows.getString(2)).isEqualTo("owner");
                assertThat(rows.getLong(3)).isEqualTo(1);
                assertThat(rows.getBoolean(4)).isFalse();
            }
            try (var rows = sql.executeQuery("SELECT workspace_id FROM documents WHERE id='legacy'")) {
                assertThat(rows.next()).isTrue(); assertThat(rows.getString(1)).isNull();
            }
            try (var rows = sql.executeQuery("SELECT COUNT(*) FROM document_versions")) {
                rows.next(); assertThat(rows.getInt(1)).isEqualTo(3);
            }
            try (var rows = sql.executeQuery("SELECT guest_id FROM workspaces WHERE id='guest'")) {
                assertThat(rows.next()).isTrue(); assertThat(rows.getString(1)).isEqualTo("guest");
            }
        }
    }
}
