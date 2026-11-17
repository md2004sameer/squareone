package com.squareone.service;
import com.squareone.dto.PreferencesPatch;
import com.squareone.model.UserPreferences;
import com.squareone.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;

@Service
@Transactional
public class PreferencesService {
    private final UserPreferencesRepository preferences;
    private final AppUserRepository users;
    public PreferencesService(UserPreferencesRepository preferences, AppUserRepository users) { this.preferences=preferences; this.users=users; }
    public UserPreferences get(String userId) {
        users.lockById(userId).orElseThrow(() -> new IllegalArgumentException("Account not found"));
        return preferences.findById(userId).orElseGet(() -> {
            UserPreferences settings=new UserPreferences(); settings.setUserId(userId); return preferences.saveAndFlush(settings);
        });
    }
    public UserPreferences update(String userId, PreferencesPatch patch) {
        UserPreferences settings=get(userId);
        if(patch.theme()!=null) settings.setTheme(patch.theme());
        if(patch.sidebarMode()!=null) settings.setSidebarMode(patch.sidebarMode());
        if(patch.sidebarWidth()!=null) settings.setSidebarWidth(patch.sidebarWidth());
        if(patch.widePage()!=null) settings.setWidePage(patch.widePage());
        if(patch.focusMode()!=null) settings.setFocusMode(patch.focusMode());
        if(patch.fontFamily()!=null) settings.setFontFamily(patch.fontFamily());
        if(patch.fontSize()!=null) settings.setFontSize(patch.fontSize());
        if(patch.lineHeight()!=null) settings.setLineHeight(patch.lineHeight());
        if(patch.documentSort()!=null) settings.setDocumentSort(patch.documentSort());
        if(patch.collapsedDocumentIds()!=null) settings.setCollapsedDocumentIds(new ArrayList<>(patch.collapsedDocumentIds()));
        settings.setUpdatedAt(System.currentTimeMillis()); return preferences.saveAndFlush(settings);
    }
}
