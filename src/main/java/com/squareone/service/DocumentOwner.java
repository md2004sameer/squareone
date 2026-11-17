package com.squareone.service;

public record DocumentOwner(String userId, String guestId, String workspaceId) {
    public DocumentOwner {
        if ((userId == null) == (guestId == null)) throw new IllegalArgumentException("Exactly one document owner must be provided");
    }
    public DocumentOwner(String userId, String guestId) { this(userId, guestId, null); }
    public static DocumentOwner user(String userId) { return new DocumentOwner(userId, null, null); }
    public static DocumentOwner guest(String guestId) { return new DocumentOwner(null, guestId, null); }
    public DocumentOwner inWorkspace(String id) { return new DocumentOwner(userId, guestId, id); }
}
