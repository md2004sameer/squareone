package com.squareone;

import org.junit.jupiter.api.Test;

import com.squareone.util.DocumentContentText;
import com.squareone.util.DocumentContentText.TableBlock;
import com.squareone.util.DocumentContentText.TextBlock;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentContentTextTests {

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
