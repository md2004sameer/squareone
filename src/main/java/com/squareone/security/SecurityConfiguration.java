package com.squareone.security;

import java.io.IOException;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.beans.factory.annotation.Value;

import com.squareone.service.DocumentService;

@Configuration
public class SecurityConfiguration {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    AuthenticationProvider authenticationProvider(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            DocumentService documentService,
            com.squareone.service.AccountService accountService,
            com.squareone.repository.AppUserRepository appUserRepository,
            SecurityContextRepository securityContextRepository,
            @Value("${server.servlet.session.cookie.secure:false}") boolean secureCookies) throws Exception {
        CookieCsrfTokenRepository csrfTokenRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfTokenRepository.setCookiePath("/");
        csrfTokenRepository.setHeaderName("X-XSRF-TOKEN");
        csrfTokenRepository.setCookieCustomizer(cookie -> cookie
                .path("/")
                .sameSite("Lax")
                .secure(secureCookies));

        http
                .headers(headers -> headers.contentSecurityPolicy(csp -> csp.policyDirectives(
                        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                        + "font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data: blob:; "
                        + "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")))
                .addFilterAfter(new AccountStatusFilter(appUserRepository), org.springframework.security.web.context.SecurityContextHolderFilter.class)
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfTokenRepository)
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
                .securityContext(context -> context.securityContextRepository(securityContextRepository))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/", "/index.html", "/stylesdocs.css", "/appdocs.js",
                                "/api/auth/session", "/api/auth/csrf", "/api/auth/signup", "/error")
                        .permitAll()
                        .requestMatchers("/api/auth/profile", "/api/auth/password", "/api/preferences/**", "/api/workspaces/**")
                        .authenticated()
                        .requestMatchers("/api/documents/**")
                        .permitAll()
                        .anyRequest()
                        .permitAll())
                .sessionManagement(session -> session
                        .sessionFixation(fixation -> fixation.migrateSession()))
                .formLogin(form -> form
                        .loginProcessingUrl("/api/auth/login")
                        .usernameParameter("email")
                        .passwordParameter("password")
                        .successHandler((request, response, authentication) ->
                                transferGuestDocuments(documentService, accountService, request.getSession(false), authentication, response))
                        .failureHandler((request, response, exception) -> writeJsonError(
                                response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid email or password")))
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .invalidateHttpSession(true)
                        .clearAuthentication(true)
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessHandler((request, response, authentication) ->
                                response.setStatus(HttpServletResponse.SC_NO_CONTENT)))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, exception) ->
                                writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required"))
                        .accessDeniedHandler((request, response, exception) ->
                                writeJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                                        "Request could not be verified. Refresh and try again.")));

        return http.build();
    }

    private void transferGuestDocuments(
            DocumentService documentService,
            com.squareone.service.AccountService accountService,
            jakarta.servlet.http.HttpSession session,
            Authentication authentication,
            HttpServletResponse response) throws IOException {
        if (session != null) {
            Object guestId = session.getAttribute(GuestSessionService.GUEST_ID_ATTRIBUTE);
            if (guestId instanceof String id) {
                AppUserDetails principal = (AppUserDetails) authentication.getPrincipal();
                documentService.transferGuestDocuments(id, accountService.getUser(principal.userId()));
                session.removeAttribute(GuestSessionService.GUEST_ID_ATTRIBUTE);
            }
        }
        response.setStatus(HttpServletResponse.SC_NO_CONTENT);
    }

    private void writeJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
