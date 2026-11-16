package com.squareone.service;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.squareone.model.AppUser;
import com.squareone.repository.AppUserRepository;

@Service
public class AccountService {

    private static final List<String> AVATAR_COLORS = List.of(
            "#617459", "#9b6b57", "#597a91", "#87679b", "#a57d36", "#567b70");

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;

    public AccountService(AppUserRepository appUserRepository, PasswordEncoder passwordEncoder) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public AppUser signUp(String name, String email, String password) {
        String normalizedEmail = normalizeEmail(email);
        if (appUserRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new EmailAlreadyRegisteredException();
        }
        validatePasswordLength(password);
        String avatarColor = AVATAR_COLORS.get(Math.floorMod(normalizedEmail.hashCode(), AVATAR_COLORS.size()));
        try {
            return appUserRepository.saveAndFlush(new AppUser(
                    name.strip(), normalizedEmail, passwordEncoder.encode(password), avatarColor));
        } catch (DataIntegrityViolationException exception) {
            throw new EmailAlreadyRegisteredException();
        }
    }

    @Transactional
    public AppUser updateProfile(String userId, String name, String email, String avatarColor) {
        AppUser user = getUser(userId);
        String normalizedEmail = normalizeEmail(email);
        if (!user.getEmail().equals(normalizedEmail)
                && appUserRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new EmailAlreadyRegisteredException();
        }
        user.setName(name.strip());
        user.setEmail(normalizedEmail);
        user.setAvatarColor(avatarColor);
        try {
            return appUserRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw new EmailAlreadyRegisteredException();
        }
    }

    @Transactional
    public void changePassword(String userId, String currentPassword, String newPassword) {
        AppUser user = getUser(userId);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new InvalidCurrentPasswordException();
        }
        validatePasswordLength(newPassword);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        appUserRepository.save(user);
    }

    private AppUser getUser(String userId) {
        return appUserRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));
    }

    private String normalizeEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    private void validatePasswordLength(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("Password must be no more than 72 bytes");
        }
    }

    public static final class EmailAlreadyRegisteredException extends RuntimeException {
        public EmailAlreadyRegisteredException() {
            super("An account with this email already exists");
        }
    }

    public static final class InvalidCurrentPasswordException extends RuntimeException {
        public InvalidCurrentPasswordException() {
            super("Current password is incorrect");
        }
    }
}
