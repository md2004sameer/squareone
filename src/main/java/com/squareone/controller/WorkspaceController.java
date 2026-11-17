package com.squareone.controller;
import com.squareone.model.Workspace;
import com.squareone.security.AppUserDetails;
import com.squareone.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/workspaces")
public class WorkspaceController {
    private final WorkspaceService workspaces;
    public WorkspaceController(WorkspaceService workspaces) { this.workspaces=workspaces; }
    @GetMapping public List<Workspace> list(@AuthenticationPrincipal AppUserDetails principal) { return workspaces.list(principal.userId()); }
    @PostMapping @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public Workspace create(@AuthenticationPrincipal AppUserDetails principal, @Valid @RequestBody WorkspaceRequest request) {
        return workspaces.create(principal.userId(), request.name(), request.description());
    }
    @PutMapping("/{id}") public Workspace update(@PathVariable String id, @AuthenticationPrincipal AppUserDetails principal, @Valid @RequestBody WorkspaceRequest request) {
        return workspaces.update(id,DocumentOwner.user(principal.userId()),request.name(),request.description());
    }
    public record WorkspaceRequest(@NotBlank @Size(max=160) String name, @Size(max=2000) String description) {}
}
