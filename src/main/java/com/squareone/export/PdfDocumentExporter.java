package com.squareone.export;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Component;

import com.squareone.model.Document;

@Component
public class PdfDocumentExporter implements DocumentExporter {

    private static final int PAGE_WIDTH = 595;
    private static final int PAGE_HEIGHT = 842;
    private static final int PAGE_MARGIN = 58;
    private static final int BODY_LINE_HEIGHT = 17;
    private static final int MAX_BODY_LINE_LENGTH = 88;
    private static final byte[] NEW_LINE = "\n".getBytes(StandardCharsets.US_ASCII);

    @Override
    public String format() {
        return "pdf";
    }

    @Override
    public String contentType() {
        return "application/pdf";
    }

    @Override
    public String fileExtension() {
        return ".pdf";
    }

    @Override
    public byte[] export(Document document) throws IOException {
        List<List<String>> pages = createPages(document);
        List<byte[]> objects = createPdfObjects(pages);
        return writePdf(objects);
    }

    private List<List<String>> createPages(Document document) {
        List<List<String>> pages = new ArrayList<>();
        List<String> currentPage = new ArrayList<>();
        List<String> titleLines = wrapText(pdfText(document.getTitle()), 36);

        currentPage.add("q 0.275 0.365 0.275 rg 58 755 32 4 re f Q");
        addText(currentPage, "F2", 9, PAGE_MARGIN, 738, "S Q U A R E O N E");
        addText(currentPage, "F1", 9, PAGE_MARGIN, 716, "DOCUMENT");
        int titleY = 670;
        for (String titleLine : titleLines) {
            addText(currentPage, "F2", 26, PAGE_MARGIN, titleY, titleLine);
            titleY -= 34;
        }
        currentPage.add("q 0.86 0.87 0.84 RG 0.8 w 58 " + (titleY - 9)
                + " m 537 " + (titleY - 9) + " l S Q");
        int bodyY = titleY - 62;

        for (String line : wrapText(pdfText(document.getContent()), MAX_BODY_LINE_LENGTH)) {
            if (bodyY < PAGE_MARGIN + BODY_LINE_HEIGHT) {
                pages.add(currentPage);
                currentPage = createContinuationPage(document.getTitle());
                bodyY = PAGE_HEIGHT - PAGE_MARGIN - 38;
            }
            addText(currentPage, "F1", 11, PAGE_MARGIN, bodyY, line);
            bodyY -= BODY_LINE_HEIGHT;
        }

        pages.add(currentPage);
        for (int index = 0; index < pages.size(); index++) {
            List<String> page = pages.get(index);
            page.add("q 0.86 0.87 0.84 RG 0.6 w 58 52 m 537 52 l S Q");
            addText(page, "F1", 8, PAGE_MARGIN, 36, "Made with Squareone");
            addText(page, "F1", 8, PAGE_WIDTH - PAGE_MARGIN - 42, 36,
                    (index + 1) + " / " + pages.size());
        }
        return pages;
    }

    private List<String> createContinuationPage(String title) {
        List<String> page = new ArrayList<>();
        addText(page, "F2", 9, PAGE_MARGIN, PAGE_HEIGHT - PAGE_MARGIN, "SQUAREONE  /  " + pdfText(title));
        page.add("q 0.86 0.87 0.84 RG 0.8 w 58 " + (PAGE_HEIGHT - PAGE_MARGIN - 12)
                + " m 537 " + (PAGE_HEIGHT - PAGE_MARGIN - 12) + " l S Q");
        return page;
    }

    private List<byte[]> createPdfObjects(List<List<String>> pages) throws IOException {
        int pageCount = pages.size();
        List<byte[]> objects = new ArrayList<>();
        objects.add(ascii("<< /Type /Catalog /Pages 2 0 R >>"));

        StringBuilder pageReferences = new StringBuilder();
        for (int index = 0; index < pageCount; index++) {
            pageReferences.append(5 + index * 2).append(" 0 R ");
        }
        objects.add(ascii("<< /Type /Pages /Kids [" + pageReferences + "] /Count " + pageCount + " >>"));
        objects.add(ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
        objects.add(ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));

        for (int index = 0; index < pageCount; index++) {
            int pageObjectNumber = 5 + index * 2;
            int contentObjectNumber = pageObjectNumber + 1;
            byte[] stream = ascii(String.join("\n", pages.get(index)) + "\n");
            String pageObject = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "
                    + PAGE_WIDTH + " " + PAGE_HEIGHT + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>"
                    + " /Contents " + contentObjectNumber + " 0 R >>";
            objects.add(ascii(pageObject));
            objects.add(streamObject(stream));
        }
        return objects;
    }

    private byte[] writePdf(List<byte[]> objects) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        output.write(ascii("%PDF-1.4\n"));
        output.write(new byte[] { '%', (byte) 0xe2, (byte) 0xe3, (byte) 0xcf, (byte) 0xd3, '\n' });

        List<Integer> offsets = new ArrayList<>();
        offsets.add(0);
        for (int index = 0; index < objects.size(); index++) {
            offsets.add(output.size());
            output.write(ascii((index + 1) + " 0 obj\n"));
            output.write(objects.get(index));
            output.write(ascii("\nendobj\n"));
        }

        int xrefOffset = output.size();
        output.write(ascii("xref\n0 " + (objects.size() + 1) + "\n"));
        output.write(ascii("0000000000 65535 f \n"));
        for (int index = 1; index < offsets.size(); index++) {
            output.write(ascii(String.format(Locale.ROOT, "%010d 00000 n \n", offsets.get(index))));
        }
        output.write(ascii("trailer\n<< /Size " + (objects.size() + 1) + " /Root 1 0 R >>\n"));
        output.write(ascii("startxref\n" + xrefOffset + "\n%%EOF\n"));
        return output.toByteArray();
    }

    private byte[] streamObject(byte[] stream) throws IOException {
        ByteArrayOutputStream object = new ByteArrayOutputStream();
        object.write(ascii("<< /Length " + stream.length + " >>\nstream\n"));
        object.write(stream);
        object.write(NEW_LINE);
        object.write(ascii("endstream"));
        return object.toByteArray();
    }

    private void addText(List<String> page, String font, int size, int x, int y, String text) {
        page.add("BT /" + font + " " + size + " Tf 1 0 0 1 " + x + " " + y
                + " Tm (" + escapePdfText(text) + ") Tj ET");
    }

    private List<String> wrapText(String text, int maxLength) {
        List<String> lines = new ArrayList<>();
        for (String paragraph : text.split("\\R", -1)) {
            StringBuilder line = new StringBuilder();
            for (String word : paragraph.split("\\s+")) {
                if (word.isEmpty()) {
                    continue;
                }
                while (word.length() > maxLength) {
                    if (!line.isEmpty()) {
                        lines.add(line.toString());
                        line.setLength(0);
                    }
                    lines.add(word.substring(0, maxLength));
                    word = word.substring(maxLength);
                }
                int candidateLength = line.length() + (line.isEmpty() ? 0 : 1) + word.length();
                if (candidateLength > maxLength && !line.isEmpty()) {
                    lines.add(line.toString());
                    line.setLength(0);
                }
                if (!line.isEmpty()) {
                    line.append(' ');
                }
                line.append(word);
            }
            lines.add(line.toString());
        }
        return lines;
    }

    private String pdfText(String text) {
        String normalized = Normalizer.normalize(text, Normalizer.Form.NFKD)
                .replace("\u2018", "'")
                .replace("\u2019", "'")
                .replace("\u201c", "\"")
                .replace("\u201d", "\"")
                .replace("\u2013", "-")
                .replace("\u2014", "--")
                .replace("\u2026", "...")
                .replace("\u2022", "*");
        StringBuilder result = new StringBuilder(normalized.length());
        normalized.codePoints().forEach(codePoint -> {
            if (Character.getType(codePoint) == Character.NON_SPACING_MARK) {
                return;
            }
            if (codePoint == '\n') {
                result.append('\n');
            } else if (codePoint == '\t') {
                result.append("    ");
            } else {
                result.appendCodePoint(codePoint >= 32 && codePoint <= 255
                        && (codePoint < 127 || codePoint > 159) ? codePoint : '?');
            }
        });
        return result.toString();
    }

    private String escapePdfText(String text) {
        return text.replace("\\", "\\\\")
                .replace("(", "\\(")
                .replace(")", "\\)")
                .replace("\n", " ");
    }

    private byte[] ascii(String value) {
        return value.getBytes(StandardCharsets.ISO_8859_1);
    }
}
