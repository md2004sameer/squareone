export function escapeHtml(text) {
  return text.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}

export function editorContentFromStored(content) {
  if (!content) {
    return "";
  }
  if (/<(?:p|h[1-3]|blockquote|pre|ul|ol|li|div|hr|details|summary|img|table|thead|tbody|tr|th|td|strong|b|em|i|u|s|del|code|mark|span|a|br)\b/iu.test(content)) {
    return content;
  }
  return content.split(/\n{2,}/u)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/gu, "<br>")}</p>`)
    .join("");
}

export function contentToPlainText(content) {
  if (!content || !/<[a-z][^>]*>/iu.test(content)) {
    return content || "";
  }

  const parsed = new DOMParser().parseFromString(content, "text/html");
  const blockTags = new Set(["BLOCKQUOTE", "DETAILS", "SUMMARY", "DIV", "H1", "H2", "H3", "LI", "OL", "P", "PRE", "TR", "UL"]);
  let text = "";
  let tableCellDepth = 0;
  let cellHasBlockText = false;
  const appendLineBreak = () => {
    if (text && !text.endsWith("\n")) {
      text += "\n";
    }
  };
  const trimTrailingLineBreaks = () => {
    text = text.replace(/\n+$/u, "");
  };
  const visit = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.nodeValue;
      if (tableCellDepth > 0 && node.nodeValue) {
        cellHasBlockText = true;
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) {
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "IMG") {
      if (!tableCellDepth || cellHasBlockText) appendLineBreak();
      const alt = node.getAttribute("alt")?.trim() || "Image";
      const source = node.getAttribute("src") || "";
      text += `${alt}${source ? ` (${source})` : ""}`;
      if (tableCellDepth) cellHasBlockText = true;
      else appendLineBreak();
      return;
    }
    if (
      node.nodeType === Node.ELEMENT_NODE
      && (node.tagName === "TD" || node.tagName === "TH")
    ) {
      if (node.previousElementSibling) {
        text += "\t";
      }
      tableCellDepth += 1;
      cellHasBlockText = false;
    }
    const isBlock = node.nodeType === Node.ELEMENT_NODE && blockTags.has(node.tagName);
    if (isBlock && tableCellDepth > 0) {
      if (cellHasBlockText) {
        appendLineBreak();
        cellHasBlockText = false;
      }
    } else if (isBlock) {
      appendLineBreak();
    }
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR") {
      appendLineBreak();
    } else {
      node.childNodes.forEach(visit);
    }
    if (isBlock && tableCellDepth === 0) {
      appendLineBreak();
    }
    if (
      node.nodeType === Node.ELEMENT_NODE
      && (node.tagName === "TD" || node.tagName === "TH")
    ) {
      trimTrailingLineBreaks();
      tableCellDepth -= 1;
      cellHasBlockText = false;
    }
  };
  visit(parsed.body);
  return text.replace(/^\n+|\n+$/gu, "").replace(/\n{3,}/gu, "\n\n");
}
