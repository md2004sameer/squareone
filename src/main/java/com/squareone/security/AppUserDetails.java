package com.squareone.security;

import com.squareone.model.AppUser;
import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.io.Serial;
import java.util.*;

public class AppUserDetails implements UserDetails, CredentialsContainer {
    @Serial private static final long serialVersionUID = 1L;
    private final String userId;
    private final String email;
    private final String status;
    private transient String passwordHash;
    public AppUserDetails(AppUser user) {
        userId = user.getId(); email = user.getEmail(); status = user.getAccountStatus(); passwordHash = user.getPasswordHash();
    }
    public String userId() { return userId; }
    @Override public Collection<? extends GrantedAuthority> getAuthorities() { return List.of(new SimpleGrantedAuthority("ROLE_USER")); }
    @Override public String getPassword() { return passwordHash; }
    @Override public String getUsername() { return email; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return "ACTIVE".equals(status); }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return "ACTIVE".equals(status); }
    @Override public void eraseCredentials() { passwordHash = null; }
}
