package com.squareone.export;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.springframework.stereotype.Component;

import com.squareone.model.Document;

@Component
public class WordDocumentExporter implements DocumentExporter {

    private static final String WORD_NAMESPACE =
            "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

    @Override
    public String format() {
        return "docx";
    }

    @Override
    public String contentType() {
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    @Override
    public String fileExtension() {
        return ".docx";
    }

    @Override
    public byte[] export(Document document) throws IOException {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream();
                ZipOutputStream wordFile = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
            addEntry(wordFile, "[Content_Types].xml", contentTypesXml());
            addEntry(wordFile, "_rels/.rels", packageRelationshipsXml());
            addEntry(wordFile, "word/document.xml", documentXml(document));
            addEntry(wordFile, "word/styles.xml", stylesXml());
            addEntry(wordFile, "word/_rels/document.xml.rels", documentRelationshipsXml());
            wordFile.finish();
            return output.toByteArray();
        }
    }

    private String contentTypesXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
                  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
                </Types>
                """;
    }

    private String packageRelationshipsXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
                </Relationships>
                """;
    }

    private String documentRelationshipsXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                </Relationships>
                """;
    }

    private String stylesXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <w:styles xmlns:w="%s">
                  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
                    <w:name w:val="Normal"/>
                    <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:color w:val="30342E"/><w:sz w:val="22"/></w:rPr>
                    <w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr>
                  </w:style>
                  <w:style w:type="paragraph" w:styleId="Title">
                    <w:name w:val="Title"/>
                    <w:basedOn w:val="Normal"/>
                    <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:color w:val="304030"/><w:sz w:val="48"/></w:rPr>
                    <w:pPr><w:spacing w:after="180"/></w:pPr>
                  </w:style>
                  <w:style w:type="paragraph" w:styleId="Subtitle">
                    <w:name w:val="Subtitle"/>
                    <w:basedOn w:val="Normal"/>
                    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="6F756B"/><w:sz w:val="18"/></w:rPr>
                    <w:pPr><w:spacing w:after="300"/></w:pPr>
                  </w:style>
                </w:styles>
                """.formatted(WORD_NAMESPACE);
    }

    private String documentXml(Document document) {
        StringBuilder body = new StringBuilder();
        body.append(paragraph("Title", document.getTitle()));
        body.append(paragraph("Subtitle", "A document from Squareone"));
        for (String line : document.getContent().split("\\R", -1)) {
            body.append(paragraph("Normal", line));
        }
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <w:document xmlns:w="%s">
                  <w:body>
                    %s
                    <w:sectPr>
                      <w:pgSz w:w="11906" w:h="16838"/>
                      <w:pgMar w:top="1080" w:right="1260" w:bottom="1080" w:left="1260" w:header="720" w:footer="720" w:gutter="0"/>
                    </w:sectPr>
                  </w:body>
                </w:document>
                """.formatted(WORD_NAMESPACE, body);
    }

    private String paragraph(String style, String text) {
        return "<w:p><w:pPr><w:pStyle w:val=\"" + style
                + "\"/></w:pPr><w:r><w:t xml:space=\"preserve\">" + xmlEscape(text)
                + "</w:t></w:r></w:p>";
    }

    private String xmlEscape(String text) {
        StringBuilder escaped = new StringBuilder(text.length());
        text.codePoints().forEach(codePoint -> {
            if (codePoint == '\t' || codePoint == '\n' || codePoint == '\r'
                    || codePoint >= 0x20 && codePoint <= 0xD7FF
                    || codePoint >= 0xE000 && codePoint <= 0xFFFD
                    || codePoint >= 0x10000 && codePoint <= 0x10FFFF) {
                switch (codePoint) {
                    case '&' -> escaped.append("&amp;");
                    case '<' -> escaped.append("&lt;");
                    case '>' -> escaped.append("&gt;");
                    default -> escaped.appendCodePoint(codePoint);
                }
            }
        });
        return escaped.toString();
    }

    private void addEntry(ZipOutputStream zip, String path, String contents) throws IOException {
        zip.putNextEntry(new ZipEntry(path));
        zip.write(contents.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
