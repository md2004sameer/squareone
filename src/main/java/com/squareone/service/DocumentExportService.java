package com.squareone.service;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.squareone.export.DocumentExporter;
import com.squareone.model.Document;

@Service
public class DocumentExportService {

    private static final Pattern INVALID_FILENAME_CHARACTERS = Pattern.compile("[^\\p{L}\\p{N}._ -]");

    private final DocumentService documentService;
    private final Map<String, DocumentExporter> exporters;

    public DocumentExportService(DocumentService documentService, List<DocumentExporter> exporters) {
        this.documentService = documentService;
        this.exporters = exporters.stream().collect(Collectors.toUnmodifiableMap(
                exporter -> exporter.format().toLowerCase(Locale.ROOT),
                Function.identity()));
    }

    public ExportedDocument export(String documentId, String format) throws IOException {
        Document document = documentService.getDocument(documentId);
        DocumentExporter exporter = exporters.get(format.toLowerCase(Locale.ROOT));
        if (exporter == null) {
            throw new IllegalArgumentException("Unsupported document export format: " + format);
        }

        String safeTitle = INVALID_FILENAME_CHARACTERS.matcher(document.getTitle()).replaceAll("_")
                .replaceAll("\\s+", " ")
                .replaceAll("^[. ]+|[. ]+$", "");
        if (safeTitle.isBlank()) {
            safeTitle = "document";
        }
        return new ExportedDocument(
                safeTitle + exporter.fileExtension(),
                exporter.contentType(),
                exporter.export(document));
    }

    public record ExportedDocument(String filename, String contentType, byte[] content) {
    }
}
