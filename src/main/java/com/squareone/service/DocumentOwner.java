package com.squareone.service;

public record DocumentOwner(String userId, String guestId) {

    public DocumentOwner {
        if ((userId == null) == (guestId == null)) {
            throw new IllegalArgumentException("Exactly one document owner must be provided");
        }
    }

    public static DocumentOwner user(String userId) {
        return new DocumentOwner(userId, null);
    }

    public static DocumentOwner guest(String guestId) {
        return new DocumentOwner(null, guestId);
    }
}
