package com.squareone.util;

import java.io.IOException;
import java.io.StringReader;
import java.util.regex.Pattern;

import javax.swing.text.MutableAttributeSet;
import javax.swing.text.html.HTML;
import javax.swing.text.html.HTMLEditorKit;
import javax.swing.text.html.parser.ParserDelegator;

public final class DocumentContentText {

    private static final Pattern RICH_TEXT_TAG = Pattern.compile(
            "</?(?:p|h[1-3]|blockquote|pre|ul|ol|li|strong|b|em|i|u|s|del|code|mark|span|a|br)\\b[^>]*>",
            Pattern.CASE_INSENSITIVE);

    private DocumentContentText() {
    }

    public static String toPlainText(String content) {
        if (content == null || !RICH_TEXT_TAG.matcher(content).find()) {
            return content == null ? "" : content;
        }

        StringBuilder text = new StringBuilder();
        HTMLEditorKit.ParserCallback callback = new HTMLEditorKit.ParserCallback() {
            @Override
            public void handleText(char[] data, int position) {
                text.append(data);
            }

            @Override
            public void handleStartTag(HTML.Tag tag, MutableAttributeSet attributes, int position) {
                appendBlockBreak(tag);
            }

            @Override
            public void handleEndTag(HTML.Tag tag, int position) {
                appendBlockBreak(tag);
            }

            @Override
            public void handleSimpleTag(HTML.Tag tag, MutableAttributeSet attributes, int position) {
                if (tag == HTML.Tag.BR) {
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

            private void appendLineBreak() {
                if (!text.isEmpty() && text.charAt(text.length() - 1) != '\n') {
                    text.append('\n');
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
}
