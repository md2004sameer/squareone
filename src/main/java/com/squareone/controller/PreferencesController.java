package com.squareone.controller;
import com.squareone.dto.PreferencesPatch;
import com.squareone.model.UserPreferences;
import com.squareone.security.AppUserDetails;
import com.squareone.service.PreferencesService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/preferences")
public class PreferencesController {
    private final PreferencesService preferences;
    public PreferencesController(PreferencesService preferences) { this.preferences=preferences; }
    @GetMapping public UserPreferences get(@AuthenticationPrincipal AppUserDetails principal) { return preferences.get(principal.userId()); }
    @PatchMapping public UserPreferences update(@AuthenticationPrincipal AppUserDetails principal, @Valid @RequestBody PreferencesPatch patch) {
        return preferences.update(principal.userId(),patch);
    }
}
