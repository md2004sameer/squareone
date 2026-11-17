package com.squareone.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "user_preferences")
@Getter @Setter
public class UserPreferences {
    @Id @Column(length = 36) private String userId;
    @Column(nullable = false, length = 16) private String theme = "system";
    @Column(nullable = false, length = 16) private String sidebarMode = "expanded";
    @Column(nullable = false) private int sidebarWidth = 260;
    @Column(nullable = false) private boolean widePage;
    @Column(nullable = false) private boolean focusMode;
    @Column(nullable = false, length = 16) private String fontFamily = "sans";
    @Column(nullable = false) private int fontSize = 18;
    @Column(nullable = false) private double lineHeight = 1.75;
    @Column(nullable = false, length = 16) private String documentSort = "updated";
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false) private List<String> collapsedDocumentIds = new ArrayList<>();
    @Column(nullable = false) private long updatedAt = System.currentTimeMillis();
}
