package com.squareone;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.squareone.model.AppUser;
import com.squareone.model.Document;
import com.squareone.repository.AppUserRepository;
import com.squareone.repository.DocumentRepository;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:squareone-auth-tests;DB_CLOSE_DELAY=-1"
})
@AutoConfigureMockMvc
class AuthenticationAndOwnershipTests {

    private static final String PASSWORD = "securePass123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void guestDocumentsMoveIntoTheNewAccountAndRemainAvailableAfterLogin() throws Exception {
        String email = uniqueEmail();
        MockHttpSession guestSession = createGuestSession();
        String documentId = createDocument(guestSession, "A guest note", "Guest notes are private.");

        mockMvc.perform(put("/api/documents/{id}", documentId)
                        .session(guestSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"title":"A guest note","content":"Saved before signup."}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/signup")
                        .session(guestSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content(signupJson("Guest Owner", email, PASSWORD)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(email));

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .session(guestSession)
                        .with(csrf())
                        .param("email", email)
                        .param("password", PASSWORD))
                .andExpect(status().isNoContent())
                .andReturn();
        MockHttpSession accountSession = (MockHttpSession) loginResult.getRequest().getSession(false);

        mockMvc.perform(get("/api/auth/session").session(accountSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.name").value("Guest Owner"));
        mockMvc.perform(get("/api/documents").session(accountSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(documentId))
                .andExpect(jsonPath("$[0].content").value("Saved before signup."));

        AppUser user = appUserRepository.findByEmailIgnoreCase(email).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(user.getPasswordHash())
                .startsWith("$2")
                .isNotEqualTo(PASSWORD);
        org.assertj.core.api.Assertions.assertThat(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
        org.assertj.core.api.Assertions.assertThat(documentRepository.findById(documentId).orElseThrow().getGuestId())
                .isNull();
    }

    @Test
    void guestAndRegisteredUsersCannotReadOrModifyDocumentsOwnedByOthersOrLegacyRows() throws Exception {
        String ownerEmail = uniqueEmail();
        MockHttpSession ownerSession = createRegisteredSession(ownerEmail, "First Owner");
        String documentId = createDocument(ownerSession, "Private note", "Only the owner can read this.");
        Document legacyDocument = new Document();
        legacyDocument.setTitle("Legacy note");
        legacyDocument.setContent("Not assigned to anyone.");
        documentRepository.saveAndFlush(legacyDocument);

        MockHttpSession secondUserSession = createRegisteredSession(uniqueEmail(), "Second Owner");
        mockMvc.perform(get("/api/documents").session(secondUserSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/documents/{id}", documentId).session(secondUserSession))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/documents/{id}", documentId)
                        .session(secondUserSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content("""
                                {"title":"Hijacked","content":"Not yours."}
                                """))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/documents/{id}", documentId).session(secondUserSession).with(csrf()))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/documents/{id}/export/txt", documentId).session(secondUserSession))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/documents/{id}/share/whatsapp", documentId).session(secondUserSession))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/documents/{id}", legacyDocument.getId()).session(secondUserSession))
                .andExpect(status().isNotFound());

        MockHttpSession firstGuestSession = createGuestSession();
        String guestDocumentId = createDocument(firstGuestSession, "Guest note", "Only one guest can read this.");
        MockHttpSession secondGuestSession = createGuestSession();
        mockMvc.perform(get("/api/documents").session(secondGuestSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/documents/{id}", guestDocumentId).session(secondGuestSession))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/documents/{id}", legacyDocument.getId()).session(secondGuestSession))
                .andExpect(status().isNotFound());
    }

    @Test
    void invalidCredentialsReturnAnAuthenticationError() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .with(csrf())
                        .param("email", uniqueEmail())
                        .param("password", PASSWORD))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void logoutReturnsTheBrowserToAnIsolatedGuestWorkspace() throws Exception {
        MockHttpSession accountSession = createRegisteredSession(uniqueEmail(), "Logged In");
        createDocument(accountSession, "Account note", "This should not remain in the guest workspace.");

        mockMvc.perform(post("/api/auth/logout").session(accountSession).with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/auth/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false));
        mockMvc.perform(get("/api/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    private MockHttpSession createGuestSession() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false))
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private MockHttpSession createRegisteredSession(String email, String name) throws Exception {
        MockHttpSession guestSession = createGuestSession();
        mockMvc.perform(post("/api/auth/signup")
                        .session(guestSession)
                        .with(csrf())
                        .contentType("application/json")
                        .content(signupJson(name, email, PASSWORD)))
                .andExpect(status().isCreated());
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .session(guestSession)
                        .with(csrf())
                        .param("email", email)
                        .param("password", PASSWORD))
                .andExpect(status().isNoContent())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private String createDocument(MockHttpSession session, String title, String content) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/documents")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"title\":\"" + title + "\",\"content\":\"" + content + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        String location = result.getResponse().getHeader("Location");
        return location.substring(location.lastIndexOf('/') + 1);
    }

    private String signupJson(String name, String email, String password) {
        return """
                {"name":"%s","email":"%s","password":"%s"}
                """.formatted(name, email, password);
    }

    private String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }
}
