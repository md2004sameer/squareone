const paths = {
  text: '<path d="M4 5h12M10 5v12M7 17h6"/>',
  heading: '<path d="M4 5v12M12 5v12M4 11h8"/>',
  table: '<rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 9h14M8 4v13"/>',
  dropdown: '<path d="m4 8 3 3 3-3M13 7h4M13 12h4M4 16h13"/>',
  bullet: '<path d="M8 5h9M8 10h9M8 15h9"/><circle cx="3.5" cy="5" r=".6"/><circle cx="3.5" cy="10" r=".6"/><circle cx="3.5" cy="15" r=".6"/>',
  checklist: '<rect x="3" y="3" width="14" height="14" rx="3"/><path d="m6 10 3 3 5-6"/>',
  code: '<path d="m6 6-4 4 4 4m8-8 4 4-4 4M12 4 8 16"/>',
  date: '<rect x="3" y="4" width="14" height="13" rx="2"/><path d="M6 2v4m8-4v4M3 8h14M7 12h1m4 0h1"/>',
  divider: '<path d="M3 10h14"/>',
  image: '<rect x="3" y="3" width="14" height="14" rx="2"/><circle cx="7" cy="7" r="1.2"/><path d="m3 14 4-4 3 3 3-5 4 6"/>',
  numbered: '<path d="M9 5h8M9 10h8M9 15h8M3 4h1v3M3 10c0-2 3-2 2 0l-2 2h2M3 15h2l-1 1 1 1H3"/>',
  quote: '<path d="M4 6h5v6H5c0 2-1 3-2 4m9-10h5v6h-4c0 2-1 3-2 4"/>',
  callout: '<circle cx="10" cy="10" r="7"/><path d="M10 9v5M10 6v.1"/>',
  more: '<circle cx="4" cy="10" r="1"/><circle cx="10" cy="10" r="1"/><circle cx="16" cy="10" r="1"/>',
};

export function commandIcon(name) {
  const level = /^heading-([123])$/u.exec(name)?.[1];
  return `<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths[level ? "heading" : name] || paths.text}${level ? `<text x="14" y="17" fill="currentColor" stroke="none" font-size="8">${level}</text>` : ""}</svg>`;
}

function command(id, title, icon, keywords, execute, extra = {}) {
  return { id, title, icon, keywords, execute, ...extra };
}

export const editorCommands = [
  command("paragraph", "Text", "text", "paragraph plain normal text", (chain) => chain.setParagraph(), { slash: false }),
  ...[1, 2, 3].map((level) => command(`heading-${level}`, `Heading ${level}`, `heading-${level}`, `heading title h${level}`, (chain) => chain.setHeading({ level }))),
  command("table", "Table", "table", "table grid rows columns spreadsheet", (chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: false })),
  command("dropdown", "Dropdown", "dropdown", "dropdown toggle collapsible details disclosure", (chain) => chain.setDetails()
    // A can() chain checks insertion without creating the node to update.
    .command(({ commands, dispatch }) => !dispatch || commands.updateAttributes("details", { open: true }))),
  command("bulletList", "Bulleted list", "bullet", "bullet bulleted list unordered", (chain) => chain.toggleBulletList(), { separator: true }),
  command("taskList", "Checklist", "checklist", "todo to-do task checklist check", (chain) => chain.toggleTaskList()),
  command("codeBlock", "Code block", "code", "code pre programming", (chain) => chain.toggleCodeBlock()),
  command("date", "Date", "date", "date calendar day", (chain, value) => chain.insertContent({ type: "text", text: value }), { dialog: "date" }),
  command("divider", "Divider", "divider", "divider horizontal rule", (chain) => chain.setHorizontalRule()),
  command("image", "Image", "image", "image photo picture url", (chain, value) => chain.setImage(value), { dialog: "image" }),
  command("orderedList", "Numbered list", "numbered", "numbered ordered list", (chain) => chain.toggleOrderedList()),
  command("blockquote", "Quote", "quote", "quote blockquote quotation", (chain) => chain.toggleBlockquote()),
  command("callout", "Callout", "callout", "callout note important", (chain) => chain.wrapIn("callout")),
];

export const slashCommands = editorCommands.filter((entry) => entry.slash !== false);

export function commandChain(editor, context, check = false) {
  let chain = (check ? editor.can().chain() : editor.chain().focus()).command(({ tr }) => {
    tr.setSelection(context.selection);
    return true;
  });
  if (context.slashRange) chain = chain.deleteRange(context.slashRange);
  return chain;
}

export function commandAvailable(editor, command, context) {
  const textStyle = command.id === "paragraph" || command.id.startsWith("heading-") || command.id === "codeBlock";
  if (!editor.isEditable || (!textStyle && (editor.isActive("code") || editor.isActive("codeBlock")))) return false;
  const chain = commandChain(editor, context, true);
  const sample = command.dialog === "image" ? { src: "https://example.invalid/image.png", alt: "" } : "Date";
  return command.execute(chain, sample).run();
}
