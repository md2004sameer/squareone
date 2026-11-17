package com.squareone.security;

import com.squareone.repository.AppUserRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

public class AccountStatusFilter extends OncePerRequestFilter {
    private final AppUserRepository users;
    public AccountStatusFilter(AppUserRepository users) { this.users=users; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        if(request.getRequestURI().startsWith("/api/") && authentication != null && authentication.getPrincipal() instanceof AppUserDetails principal) {
            var user=users.findById(principal.userId());
            if(user.isEmpty() || !"ACTIVE".equals(user.get().getAccountStatus())) {
                SecurityContextHolder.clearContext();
                if(request.getSession(false)!=null) request.getSession(false).invalidate();
                response.setStatus(401); response.setContentType("application/json");
                response.getWriter().write("{\"message\":\"Please log in again to access your account.\"}"); return;
            }
        }
        chain.doFilter(request,response);
    }
}
