package com.squareone.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "document_versions")
@Getter @Setter
public class DocumentVersion {
    @Id @Column(length = 36) private String id = UUID.randomUUID().toString();
    @Column(nullable = false, length = 36) private String documentId;
    @Column(nullable = false) private long revision;
    @Column(nullable = false, length = 160) private String title;
    @Column(nullable = false, columnDefinition = "text") private String content;
    @JdbcTypeCode(SqlTypes.JSON) private Map<String, Object> contentJson;
    @Column(nullable = false, length = 40) private String contentFormat;
    @Column(nullable = false) private int formatVersion;
    @Column(nullable = false) private long createdAt = System.currentTimeMillis();
    @Column(length = 36) private String editorUserId;
    @Column(nullable = false, length = 32) private String reason;
}
