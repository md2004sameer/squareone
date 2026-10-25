package com.squareone.export;

import java.nio.charset.StandardCharsets;

import org.springframework.stereotype.Component;

import com.squareone.model.Document;

@Component
public class PlainTextDocumentExporter implements DocumentExporter {

    @Override
    public String format() {
        return "txt";
    }

    @Override
    public String contentType() {
        return "text/plain;charset=UTF-8";
    }

    @Override
    public String fileExtension() {
        return ".txt";
    }

    @Override
    public byte[] export(Document document) {
        String content = document.getTitle() + System.lineSeparator()
                + "=".repeat(Math.max(3, document.getTitle().length())) + System.lineSeparator()
                + System.lineSeparator()
                + document.getContent();
        return content.getBytes(StandardCharsets.UTF_8);
    }
}
