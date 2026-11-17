package com.squareone.model;

import java.util.UUID;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "documents")
@Getter @Setter
public class Document {

    @Id
    @Column(nullable = false, updatable = false, length = 36)
    private String id;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false)
    private long createdAt;

    @Column(nullable = false)
    private long updatedAt;

    @Column(name = "parent_id", length = 36)
    private String parentId;

    @Column(nullable = false)
    private boolean favorite;

    private Long deletedAt;

    @Column(length = 36) private String workspaceId;
    @Column(nullable = false, length = 40) private String contentFormat = "tiptap-html";
    @Column(nullable = false) private int formatVersion = 1;
    @JdbcTypeCode(SqlTypes.JSON) private Map<String, Object> contentJson;
    @Column(length = 32) private String icon;
    @Column(length = 2048) private String coverRef;
    @Column(nullable = false) private boolean archived;
    @Column(nullable = false) private long sortOrder;
    @Column(nullable = false) private long lastEditedAt = System.currentTimeMillis();
    @Column(nullable = false) private long revision = 1;
    @jakarta.persistence.Version private long rowVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    private AppUser ownerUser;

    @Column(name = "guest_id", length = 36)
    private String guestId;

    public Document() {
        this.id = UUID.randomUUID().toString();
        this.title = "Untitled";
        this.content = "";
        this.createdAt = System.currentTimeMillis();
        this.updatedAt = this.createdAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(long createdAt) {
        this.createdAt = createdAt;
    }

    public long getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(long updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getParentId() {
        return parentId;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
    }

    public boolean isFavorite() {
        return favorite;
    }

    public Long getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Long deletedAt) {
        this.deletedAt = deletedAt;
    }

    public void setFavorite(boolean favorite) {
        this.favorite = favorite;
    }

    public AppUser getOwnerUser() {
        return ownerUser;
    }

    public void setOwnerUser(AppUser ownerUser) {
        this.ownerUser = ownerUser;
        this.guestId = null;
    }

    public String getGuestId() {
        return guestId;
    }

    public void setGuestId(String guestId) {
        this.ownerUser = null;
        this.guestId = guestId;
    }
}
