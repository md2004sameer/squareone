package com.squareone;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.nullValue;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = {
        "spring.profiles.active=h2-test",
        "spring.config.import=",
        "DATABASE_SCHEMA=PUBLIC",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.autoconfigure.exclude=org.springframework.boot.session.jdbc.autoconfigure.JdbcSessionAutoConfiguration",
        "spring.datasource.url=jdbc:h2:mem:squareone-organization-tests;DB_CLOSE_DELAY=-1"
})
@AutoConfigureMockMvc
class DocumentOrganizationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void organizationPersistsAndDeletingParentPromotesItsChildren() throws Exception {
        MockHttpSession session = createGuestSession();
        String parentId = createDocument(session, "Parent");
        String childId = createDocument(session, "Child");
        String grandchildId = createDocument(session, "Grandchild");

        updateOrganization(session, childId, parentId, true)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.parentId").value(parentId))
                .andExpect(jsonPath("$.favorite").value(true));
        updateOrganization(session, grandchildId, childId, false)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.parentId").value(childId));

        mockMvc.perform(post("/api/documents/{id}/duplicate", childId)
                        .session(session)
                        .with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Child (copy)"))
                .andExpect(jsonPath("$.parentId").value(parentId))
                .andExpect(jsonPath("$.favorite").value(false));

        mockMvc.perform(get("/api/documents/{id}", childId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.favorite").value(true));

        mockMvc.perform(delete("/api/documents/{id}", parentId).session(session).with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/documents/{id}", childId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.parentId").value(nullValue()));
        mockMvc.perform(get("/api/documents/{id}", grandchildId).session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.parentId").value(childId));
    }

    @Test
    void organizationRejectsCyclesAndParentsOwnedByAnotherWorkspace() throws Exception {
        MockHttpSession firstSession = createGuestSession();
        String parentId = createDocument(firstSession, "Parent");
        String childId = createDocument(firstSession, "Child");
        updateOrganization(firstSession, childId, parentId, false).andExpect(status().isOk());

        updateOrganization(firstSession, parentId, childId, false)
                .andExpect(status().isNotFound());

        MockHttpSession secondSession = createGuestSession();
        String unrelatedId = createDocument(secondSession, "Unrelated");
        updateOrganization(secondSession, unrelatedId, parentId, false)
                .andExpect(status().isNotFound());
    }

    @Test
    void trashPreservesContentAndFavoritesAndRestoreKeepsChildrenAtRoot() throws Exception {
        MockHttpSession session = createGuestSession();
        String parentId = createDocument(session, "Keep my note");
        String childId = createDocument(session, "Child");
        updateOrganization(session, parentId, null, true).andExpect(status().isOk());
        updateOrganization(session, childId, parentId, false).andExpect(status().isOk());
        mockMvc.perform(put("/api/documents/{id}", parentId).session(session).with(csrf())
                        .contentType("application/json")
                        .content("{\"title\":\"Keep my note\",\"content\":\"<p>Recover this text</p>\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/documents/{id}", parentId).session(session).with(csrf()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/documents").session(session))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(childId));
        mockMvc.perform(get("/api/documents/trash").session(session))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].content").value("<p>Recover this text</p>"))
                .andExpect(jsonPath("$[0].deletedAt").isNumber());
        mockMvc.perform(get("/api/documents/{id}", parentId).session(session)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/documents/{id}/export/txt", parentId).session(session)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/documents/{id}/share/whatsapp", parentId).session(session)).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/documents/{id}/duplicate", parentId).session(session).with(csrf())).andExpect(status().isNotFound());
        mockMvc.perform(put("/api/documents/{id}", parentId).session(session).with(csrf())
                .contentType("application/json").content("{\"title\":\"No\",\"content\":\"No\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/documents/trash/{id}/restore", parentId).session(session).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("<p>Recover this text</p>"))
                .andExpect(jsonPath("$.favorite").value(true))
                .andExpect(jsonPath("$.deletedAt").value(nullValue()));
        mockMvc.perform(get("/api/documents/{id}", childId).session(session))
                .andExpect(jsonPath("$.parentId").value(nullValue()));
        mockMvc.perform(get("/api/documents/trash").session(session)).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void trashIsPrivateAndPermanentDeletionRequiresTrashedDocument() throws Exception {
        MockHttpSession owner = createGuestSession();
        MockHttpSession other = createGuestSession();
        String id = createDocument(owner, "Private trash");
        mockMvc.perform(delete("/api/documents/trash/{id}", id).session(owner).with(csrf()))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/documents/{id}", id).session(owner).with(csrf())).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/documents/trash").session(other)).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(post("/api/documents/trash/{id}/restore", id).session(other).with(csrf())).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/documents/trash/{id}", id).session(other).with(csrf())).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/documents/trash/{id}", id).session(owner).with(csrf())).andExpect(status().isNoContent());
        mockMvc.perform(post("/api/documents/trash/{id}/restore", id).session(owner).with(csrf())).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/documents/trash").session(owner)).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void restoringAfterParentWasPermanentlyDeletedPromotesDocumentToRoot() throws Exception {
        MockHttpSession session = createGuestSession();
        String parentId = createDocument(session, "Parent");
        String childId = createDocument(session, "Child");
        updateOrganization(session, childId, parentId, false).andExpect(status().isOk());
        mockMvc.perform(delete("/api/documents/{id}", childId).session(session).with(csrf())).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/documents/{id}", parentId).session(session).with(csrf())).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/documents/trash/{id}", parentId).session(session).with(csrf())).andExpect(status().isNoContent());
        mockMvc.perform(post("/api/documents/trash/{id}/restore", childId).session(session).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.parentId").value(nullValue()));
    }

    private MockHttpSession createGuestSession() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/session"))
                .andExpect(status().isOk())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private String createDocument(MockHttpSession session, String title) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/documents")
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"title\":\"" + title + "\",\"content\":\"\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        String location = result.getResponse().getHeader("Location");
        String documentId = location.substring(location.lastIndexOf('/') + 1);
        mockMvc.perform(put("/api/documents/{id}", documentId)
                        .session(session)
                        .with(csrf())
                        .contentType("application/json")
                        .content("{\"title\":\"" + title + "\",\"content\":\"\"}"))
                .andExpect(status().isOk());
        return documentId;
    }

    private org.springframework.test.web.servlet.ResultActions updateOrganization(
            MockHttpSession session,
            String documentId,
            String parentId,
            boolean favorite) throws Exception {
        String parentJson = parentId == null ? "null" : "\"" + parentId + "\"";
        return mockMvc.perform(put("/api/documents/{id}/organization", documentId)
                .session(session)
                .with(csrf())
                .contentType("application/json")
                .content("{\"parentId\":" + parentJson + ",\"favorite\":" + favorite + "}"));
    }
}
