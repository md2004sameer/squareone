package com.squareone;

import org.junit.jupiter.api.Test;

import com.squareone.util.DocumentContentText;
import com.squareone.util.DocumentContentText.TableBlock;
import com.squareone.util.DocumentContentText.TextBlock;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentContentTextTests {

    @Test
    void closedDropdownsAndBodyImagesHaveReadableExportFallbacks() throws Exception {
        String content = "<details><summary>Project notes</summary><div data-type=\"detailsContent\">"
                + "<p>Keep the nested writing.</p></div></details>"
                + "<img src=\"https://example.com/diagram.png\" alt=\"Architecture sketch\">";
        String expected = "Project notes\nKeep the nested writing.\nArchitecture sketch (https://example.com/diagram.png)";
        assertThat(DocumentContentText.toPlainText(content)).isEqualTo(expected);
        assertThat(DocumentContentText.toBlocks(content)).containsExactly(new TextBlock(expected));

        var document = new com.squareone.model.Document();
        document.setTitle("Editor blocks");
        document.setContent(content);
        assertThat(new String(new com.squareone.export.PlainTextDocumentExporter().export(document), java.nio.charset.StandardCharsets.UTF_8))
                .contains(expected);
        assertThat(new String(new com.squareone.export.PdfDocumentExporter().export(document), java.nio.charset.StandardCharsets.ISO_8859_1))
                .contains("Project notes", "Keep the nested writing.", "https://example.com/diagram.png");
        try (var zip = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(
                new com.squareone.export.WordDocumentExporter().export(document)))) {
            java.util.zip.ZipEntry entry;
            String xml = "";
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.getName().equals("word/document.xml")) xml = new String(zip.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            }
            assertThat(xml).contains("Project notes", "Keep the nested writing.", "Architecture sketch", "https://example.com/diagram.png");
        }
    }

    @Test
    void imageOnlyDocumentsAreHtmlAndUseAnAltTextOrUrlFallback() {
        assertThat(DocumentContentText.toPlainText("<img src=\"https://example.com/photo.jpg\">"))
                .isEqualTo("Image (https://example.com/photo.jpg)");
        assertThat(DocumentContentText.toBlocks("<img src=\"https://example.com/photo.jpg\" alt=\"Photo\">"))
                .containsExactly(new TextBlock("Photo (https://example.com/photo.jpg)"));
    }

    @Test
    void extractsTextFromCalloutsAndKeepsFollowingBlocksSeparate() {
        String content = "<div data-type=\"callout\"><p>Remember this</p></div><p>After the callout</p>";

        assertThat(DocumentContentText.toPlainText(content))
                .isEqualTo("Remember this\nAfter the callout");
    }

    @Test
    void convertsTableCellsToTabsAndPreservesTableStructure() {
        String content = """
                <p>Before</p>
                <table><tbody>
                  <tr><th><p>Item</p></th><th><p>Count</p></th></tr>
                  <tr><td><p>Tea</p></td><td><p>2</p></td></tr>
                </tbody></table>
                <p>After</p>
                """;

        assertThat(DocumentContentText.toPlainText(content))
                .isEqualTo("Before\nItem\tCount\nTea\t2\nAfter");

        var blocks = DocumentContentText.toBlocks(content);
        assertThat(blocks).hasSize(3);
        assertThat(blocks.get(0)).isEqualTo(new TextBlock("Before"));
        assertThat(blocks.get(1)).isInstanceOf(TableBlock.class);
        TableBlock table = (TableBlock) blocks.get(1);
        assertThat(table.rows()).hasSize(2);
        assertThat(table.rows().get(0).header()).isTrue();
        assertThat(table.rows().get(0).cells()).containsExactly("Item", "Count");
        assertThat(table.rows().get(1).cells()).containsExactly("Tea", "2");
        assertThat(blocks.get(2)).isEqualTo(new TextBlock("After"));
    }

    @Test
    void preservesMultipleParagraphsInsideATableCell() {
        String content = "<table><tbody><tr><td><p>First line</p><p>Second line</p></td></tr></tbody></table>";

        assertThat(DocumentContentText.toPlainText(content)).isEqualTo("First line\nSecond line");

        TableBlock table = (TableBlock) DocumentContentText.toBlocks(content).get(0);
        assertThat(table.rows().get(0).cells()).containsExactly("First line\nSecond line");
    }
}
