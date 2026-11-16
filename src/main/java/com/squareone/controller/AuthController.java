package com.squareone.controller;

import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.squareone.model.AppUser;
import com.squareone.security.AppUserDetails;
import com.squareone.security.GuestSessionService;
import com.squareone.service.AccountService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String DEFAULT_AVATAR_COLOR = "#617459";

    private final AccountService accountService;
    private final GuestSessionService guestSessionService;
    private final SecurityContextRepository securityContextRepository;

    public AuthController(
            AccountService accountService,
            GuestSessionService guestSessionService,
            SecurityContextRepository securityContextRepository) {
        this.accountService = accountService;
        this.guestSessionService = guestSessionService;
        this.securityContextRepository = securityContextRepository;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken csrfToken) {
        return new CsrfResponse(csrfToken.getToken(), csrfToken.getHeaderName());
    }

    @GetMapping("/session")
    public SessionResponse session(
            @AuthenticationPrincipal AppUserDetails principal,
            HttpSession session) {
        if (principal == null) {
            String guestId = guestSessionService.getOrCreateGuestId(session);
            return new SessionResponse(false, "Guest", null, "G", DEFAULT_AVATAR_COLOR, guestId);
        }
        return SessionResponse.from(principal.user());
    }

    @PostMapping("/signup")
    public ResponseEntity<AccountCreatedResponse> signUp(@Valid @RequestBody SignupRequest request) {
        AppUser user = accountService.signUp(request.name(), request.email(), request.password());
        return ResponseEntity.status(HttpStatus.CREATED).body(new AccountCreatedResponse(
                user.getName(), user.getEmail(), SessionResponse.initials(user.getName()), user.getAvatarColor()));
    }

    @PutMapping("/profile")
    public ResponseEntity<SessionResponse> updateProfile(
            @AuthenticationPrincipal AppUserDetails principal,
            @Valid @RequestBody ProfileRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        AppUser updatedUser = accountService.updateProfile(
                principal.user().getId(),
                request.name(),
                request.email(),
                request.avatarColor() == null ? principal.user().getAvatarColor() : request.avatarColor());

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(
                new AppUserDetails(updatedUser), null, authentication.getAuthorities()));
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, httpRequest, httpResponse);
        return ResponseEntity.ok(SessionResponse.from(updatedUser));
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal AppUserDetails principal,
            @Valid @RequestBody PasswordRequest request) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        accountService.changePassword(
                principal.user().getId(), request.currentPassword(), request.newPassword());
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(AccountService.EmailAlreadyRegisteredException.class)
    public ResponseEntity<ErrorResponse> handleEmailAlreadyRegistered(
            AccountService.EmailAlreadyRegisteredException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler(AccountService.InvalidCurrentPasswordException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCurrentPassword(
            AccountService.InvalidCurrentPasswordException exception) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleInvalidInput(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        FieldError fieldError = exception.getBindingResult().getFieldErrors().stream().findFirst().orElse(null);
        String message = fieldError == null ? "Please check the submitted information"
                : switch (fieldError.getField()) {
                    case "name" -> "Name is required and must be 100 characters or fewer";
                    case "email" -> "Enter a valid email address";
                    case "password", "newPassword" -> "Password must be at least 8 characters";
                    case "avatarColor" -> "Choose a valid avatar color";
                    default -> "Please check the submitted information";
                };
        return ResponseEntity.badRequest().body(new ErrorResponse(message));
    }

    public record SignupRequest(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 8, max = 72) String password) {
    }

    public record ProfileRequest(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Email @Size(max = 254) String email,
            @Pattern(regexp = "^#[0-9a-fA-F]{6}$") String avatarColor) {
    }

    public record PasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 8, max = 72) String newPassword) {
    }

    public record CsrfResponse(String token, String headerName) {
    }

    public record SessionResponse(
            boolean authenticated,
            String name,
            String email,
            String avatar,
            String avatarColor,
            String workspaceId) {

        private static SessionResponse from(AppUser user) {
            return new SessionResponse(
                    true,
                    user.getName(),
                    user.getEmail(),
                    initials(user.getName()),
                    user.getAvatarColor(),
                    user.getId());
        }

        static String initials(String name) {
            String[] parts = name.strip().split("\\s+");
            if (parts.length == 1) {
                return parts[0].substring(0, 1).toUpperCase();
            }
            return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
        }
    }

    public record ErrorResponse(String message) {
    }

    public record AccountCreatedResponse(String name, String email, String avatar, String avatarColor) {
    }
}
