package com.squareone.model;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "app_users")
public class AppUser {

    @Id
    @Column(nullable = false, updatable = false, length = 36)
    private String id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(nullable = false, length = 100)
    private String passwordHash;

    @Column(nullable = false, length = 7)
    private String avatarColor;

    @Column(nullable = false)
    private long createdAt;

    @Column(nullable = false)
    private long updatedAt;

    @Column(nullable = false, length = 32)
    private String authProvider = "PASSWORD";

    @Column(nullable = false, length = 24)
    private String accountStatus = "ACTIVE";

    @Column(length = 2048)
    private String avatarRef;

    protected AppUser() {
    }

    public AppUser(String name, String email, String passwordHash, String avatarColor) {
        this.id = UUID.randomUUID().toString();
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
        this.avatarColor = avatarColor;
        this.createdAt = System.currentTimeMillis();
        this.updatedAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getAvatarColor() {
        return avatarColor;
    }

    public void setAvatarColor(String avatarColor) {
        this.avatarColor = avatarColor;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(long updatedAt) { this.updatedAt = updatedAt; }
    public String getAuthProvider() { return authProvider; }
    public String getAccountStatus() { return accountStatus; }
    public void setAccountStatus(String status) { this.accountStatus = status; }
    public String getAvatarRef() { return avatarRef; }
    public void setAvatarRef(String avatarRef) { this.avatarRef = avatarRef; }
}
