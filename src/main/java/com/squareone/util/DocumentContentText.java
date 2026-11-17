package com.squareone.util;

import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import javax.swing.text.MutableAttributeSet;
import javax.swing.text.html.HTML;
import javax.swing.text.html.HTMLEditorKit;
import javax.swing.text.html.parser.ParserDelegator;

public final class DocumentContentText {

    private static final Pattern RICH_TEXT_TAG = Pattern.compile(
            "</?(?:p|h[1-3]|blockquote|pre|ul|ol|li|div|hr|details|summary|img|table|thead|tbody|tr|th|td|strong|b|em|i|u|s|del|code|mark|span|a|br)\\b[^>]*>",
            Pattern.CASE_INSENSITIVE);

    private DocumentContentText() {
    }

    public static String toPlainText(String content) {
        if (content == null || !RICH_TEXT_TAG.matcher(content).find()) {
            return content == null ? "" : content;
        }

        StringBuilder text = new StringBuilder();
        boolean[] inTableRow = { false };
        boolean[] inTableCell = { false };
        boolean[] cellHasBlockText = { false };
        boolean[] firstTableCell = { true };
        HTMLEditorKit.ParserCallback callback = new HTMLEditorKit.ParserCallback() {
            @Override
            public void handleText(char[] data, int position) {
                text.append(data);
                if (inTableCell[0] && data.length > 0) {
                    cellHasBlockText[0] = true;
                }
            }

            @Override
            public void handleStartTag(HTML.Tag tag, MutableAttributeSet attributes, int position) {
                if (tag == HTML.Tag.TABLE) {
                    appendLineBreak();
                } else if (tag == HTML.Tag.TR) {
                    inTableRow[0] = true;
                    firstTableCell[0] = true;
                    appendLineBreak();
                } else if (tag == HTML.Tag.TD || tag == HTML.Tag.TH) {
                    if (inTableRow[0] && !firstTableCell[0]) {
                        text.append('\t');
                    }
                    firstTableCell[0] = false;
                    inTableCell[0] = true;
                    cellHasBlockText[0] = false;
                    return;
                }
                if (inTableCell[0] && isCellBlockTag(tag)) {
                    if (cellHasBlockText[0]) {
                        appendLineBreak();
                        cellHasBlockText[0] = false;
                    }
                } else {
                    appendBlockBreak(tag);
                }
            }

            @Override
            public void handleEndTag(HTML.Tag tag, int position) {
                if (tag == HTML.Tag.TABLE || tag == HTML.Tag.TR) {
                    trimTrailingLineBreaks();
                    appendLineBreak();
                    if (tag == HTML.Tag.TR) {
                        inTableRow[0] = false;
                    }
                } else if (tag == HTML.Tag.TD || tag == HTML.Tag.TH) {
                    trimTrailingLineBreaks();
                    inTableCell[0] = false;
                    cellHasBlockText[0] = false;
                } else if (inTableCell[0] && isCellBlockTag(tag)) {
                    return;
                } else {
                    appendBlockBreak(tag);
                }
            }

            @Override
            public void handleSimpleTag(HTML.Tag tag, MutableAttributeSet attributes, int position) {
                if (tag == HTML.Tag.IMG) {
                    if (!inTableCell[0] || cellHasBlockText[0]) appendLineBreak();
                    text.append(imageDescription(attributes));
                    if (inTableCell[0]) cellHasBlockText[0] = true;
                    else appendLineBreak();
                } else if (tag == HTML.Tag.BR || isCollapsibleTag(tag)) {
                    appendLineBreak();
                } else if (tag == HTML.Tag.HR) {
                    appendLineBreak();
                }
            }

            private void appendBlockBreak(HTML.Tag tag) {
                if (tag == HTML.Tag.P || tag == HTML.Tag.H1 || tag == HTML.Tag.H2 || tag == HTML.Tag.H3
                        || tag == HTML.Tag.BLOCKQUOTE || tag == HTML.Tag.PRE || tag == HTML.Tag.LI
                        || tag == HTML.Tag.DIV) {
                    appendLineBreak();
                }
            }

            private boolean isCellBlockTag(HTML.Tag tag) {
                return tag == HTML.Tag.P || tag == HTML.Tag.H1 || tag == HTML.Tag.H2 || tag == HTML.Tag.H3
                        || tag == HTML.Tag.BLOCKQUOTE || tag == HTML.Tag.PRE || tag == HTML.Tag.DIV;
            }

            private void appendLineBreak() {
                if (!text.isEmpty() && text.charAt(text.length() - 1) != '\n') {
                    text.append('\n');
                }
            }

            private void trimTrailingLineBreaks() {
                while (!text.isEmpty() && text.charAt(text.length() - 1) == '\n') {
                    text.setLength(text.length() - 1);
                }
            }
        };

        try {
            new ParserDelegator().parse(new StringReader(content), callback, true);
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to read rich document content", exception);
        }
        return text.toString().strip();
    }

    public static List<Block> toBlocks(String content) {
        if (content == null || content.isEmpty()) {
            return List.of();
        }
        if (!RICH_TEXT_TAG.matcher(content).find()) {
            return List.of(new TextBlock(content));
        }

        BlockParser parser = new BlockParser();
        try {
            new ParserDelegator().parse(new StringReader(content), parser, true);
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to read rich document content", exception);
        }
        return parser.finish();
    }

    private static boolean isCollapsibleTag(HTML.Tag tag) {
        return "details".equalsIgnoreCase(tag.toString()) || "summary".equalsIgnoreCase(tag.toString());
    }

    private static String imageDescription(MutableAttributeSet attributes) {
        Object alt = attributes.getAttribute(HTML.Attribute.ALT);
        Object source = attributes.getAttribute(HTML.Attribute.SRC);
        String label = alt == null || alt.toString().isBlank() ? "Image" : alt.toString().strip();
        return label + (source == null || source.toString().isBlank() ? "" : " (" + source + ")");
    }

    public sealed interface Block permits TextBlock, TableBlock {
    }

    public record TextBlock(String text) implements Block {
    }

    public record TableRow(List<String> cells, boolean header) {
        public TableRow {
            cells = List.copyOf(cells);
        }
    }

    public record TableBlock(List<TableRow> rows) implements Block {
        public TableBlock {
            rows = List.copyOf(rows);
        }
    }

    private static final class BlockParser extends HTMLEditorKit.ParserCallback {

        private final List<Block> blocks = new ArrayList<>();
        private final StringBuilder text = new StringBuilder();
        private List<TableRow> tableRows;
        private List<String> rowCells;
        private StringBuilder cellText;
        private boolean cellHeader;
        private boolean rowHeader;

        @Override
        public void handleText(char[] data, int position) {
            if (cellText != null) {
                cellText.append(data);
            } else if (tableRows == null) {
                text.append(data);
            }
        }

        @Override
        public void handleStartTag(HTML.Tag tag, MutableAttributeSet attributes, int position) {
            if (tag == HTML.Tag.TABLE && tableRows == null) {
                flushText();
                tableRows = new ArrayList<>();
                return;
            }
            if (tableRows != null) {
                if (tag == HTML.Tag.TR) {
                    startRow();
                } else if (tag == HTML.Tag.TD || tag == HTML.Tag.TH) {
                    if (rowCells == null) {
                        startRow();
                    }
                    cellText = new StringBuilder();
                    cellHeader = tag == HTML.Tag.TH;
                    rowHeader &= cellHeader;
                } else if (cellText != null && isBlockTag(tag)) {
                    appendLineBreak(cellText);
                }
            } else if (isBlockTag(tag)) {
                appendLineBreak(text);
            }
        }

        @Override
        public void handleEndTag(HTML.Tag tag, int position) {
            if (tableRows != null) {
                if ((tag == HTML.Tag.TD || tag == HTML.Tag.TH) && cellText != null) {
                    finishCell();
                } else if (tag == HTML.Tag.TR) {
                    finishRow();
                } else if (tag == HTML.Tag.TABLE) {
                    finishRow();
                    if (!tableRows.isEmpty()) {
                        blocks.add(new TableBlock(tableRows));
                    }
                    tableRows = null;
                } else if (cellText != null && isBlockTag(tag)) {
                    appendLineBreak(cellText);
                }
            } else if (isBlockTag(tag)) {
                appendLineBreak(text);
            }
        }

        @Override
        public void handleSimpleTag(HTML.Tag tag, MutableAttributeSet attributes, int position) {
            if (tag == HTML.Tag.IMG) {
                StringBuilder target = cellText == null ? text : cellText;
                appendLineBreak(target);
                target.append(imageDescription(attributes));
                if (cellText == null) appendLineBreak(target);
            } else if (tag == HTML.Tag.BR || isCollapsibleTag(tag)) {
                appendLineBreak(cellText == null ? text : cellText);
            } else if (tag == HTML.Tag.HR && tableRows == null) {
                appendLineBreak(text);
            }
        }

        private List<Block> finish() {
            finishRow();
            if (tableRows != null && !tableRows.isEmpty()) {
                blocks.add(new TableBlock(tableRows));
                tableRows = null;
            }
            flushText();
            return List.copyOf(blocks);
        }

        private void startRow() {
            finishRow();
            rowCells = new ArrayList<>();
            rowHeader = true;
        }

        private void finishCell() {
            rowCells.add(cellText.toString().strip());
            cellText = null;
        }

        private void finishRow() {
            if (cellText != null) {
                finishCell();
            }
            if (tableRows != null && rowCells != null && !rowCells.isEmpty()) {
                tableRows.add(new TableRow(rowCells, rowHeader));
            }
            rowCells = null;
        }

        private void flushText() {
            String value = text.toString().strip();
            if (!value.isEmpty()) {
                blocks.add(new TextBlock(value));
            }
            text.setLength(0);
        }

        private static boolean isBlockTag(HTML.Tag tag) {
            return tag == HTML.Tag.P || tag == HTML.Tag.H1 || tag == HTML.Tag.H2 || tag == HTML.Tag.H3
                    || tag == HTML.Tag.BLOCKQUOTE || tag == HTML.Tag.PRE || tag == HTML.Tag.LI
                    || tag == HTML.Tag.DIV;
        }

        private static void appendLineBreak(StringBuilder target) {
            if (target != null && !target.isEmpty() && target.charAt(target.length() - 1) != '\n') {
                target.append('\n');
            }
        }
    }
}
