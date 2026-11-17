package com.squareone.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.util.UUID;

@Entity
@Table(name = "workspaces")
@Getter @Setter
public class Workspace {
    @Id @Column(length = 36) private String id = UUID.randomUUID().toString();
    @Column(nullable = false, length = 160) private String name;
    @Column(nullable = false, length = 2000) private String description = "";
    @Column(length = 36) private String ownerUserId;
    @Column(length = 36) private String guestId;
    @Column(length = 36) private String defaultForUserId;
    @Column(nullable = false) private long createdAt = System.currentTimeMillis();
    @Column(nullable = false) private long updatedAt = createdAt;
}
