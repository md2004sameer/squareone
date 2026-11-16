package com.squareone;

import org.junit.jupiter.api.Test;

import com.squareone.util.DocumentContentText;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentContentTextTests {

    @Test
    void extractsTextFromCalloutsAndKeepsFollowingBlocksSeparate() {
        String content = "<div data-type=\"callout\"><p>Remember this</p></div><p>After the callout</p>";

        assertThat(DocumentContentText.toPlainText(content))
                .isEqualTo("Remember this\nAfter the callout");
    }
}
