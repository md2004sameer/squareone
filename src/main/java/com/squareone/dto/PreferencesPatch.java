package com.squareone.dto;
import jakarta.validation.constraints.*;
import java.util.List;
public record PreferencesPatch(
    @Pattern(regexp="system|light|dark") String theme,
    @Pattern(regexp="expanded|compact|hidden") String sidebarMode,
    @Min(220) @Max(400) Integer sidebarWidth,
    Boolean widePage, Boolean focusMode,
    @Pattern(regexp="sans|serif|mono") String fontFamily,
    @Min(12) @Max(32) Integer fontSize,
    @DecimalMin("1.2") @DecimalMax("2.5") Double lineHeight,
    @Pattern(regexp="updated|created|title|manual") String documentSort,
    @Size(max=2000) List<@Pattern(regexp="[a-fA-F0-9-]{36}") String> collapsedDocumentIds
) {}
