package com.squareone.security;

import java.util.UUID;

import jakarta.servlet.http.HttpSession;

import org.springframework.stereotype.Service;

@Service
public class GuestSessionService {

    public static final String GUEST_ID_ATTRIBUTE = "squareone.guest-id";

    public String getOrCreateGuestId(HttpSession session) {
        Object guestId = session.getAttribute(GUEST_ID_ATTRIBUTE);
        if (guestId instanceof String id) {
            return id;
        }
        String id = UUID.randomUUID().toString();
        session.setAttribute(GUEST_ID_ATTRIBUTE, id);
        return id;
    }

    public String getGuestId(HttpSession session) {
        Object guestId = session.getAttribute(GUEST_ID_ATTRIBUTE);
        return guestId instanceof String id ? id : null;
    }
}
