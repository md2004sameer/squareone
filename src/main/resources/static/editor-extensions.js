import {
  mergeAttributes, Node, StarterKit, Underline, Link, TextStyle, Color,
  Highlight, Placeholder, TaskList, TaskItem, Table, TableRow, TableCell, TableHeader,
} from "./vendor/editor.js?v=25";

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "callout" }), 0];
  },
});

export const slashCommands = [
  {
    title: "Heading 1",
    icon: "H1",
    description: "Large section heading",
    keywords: "heading title h1",
    command: (chain) => chain.setNode("heading", { level: 1 }),
  },
  {
    title: "Heading 2",
    icon: "H2",
    description: "Medium section heading",
    keywords: "heading h2",
    command: (chain) => chain.setNode("heading", { level: 2 }),
  },
  {
    title: "Heading 3",
    icon: "H3",
    description: "Small section heading",
    keywords: "heading h3",
    command: (chain) => chain.setNode("heading", { level: 3 }),
  },
  {
    title: "Bullet List",
    icon: "•",
    description: "Create a simple list",
    keywords: "bullet bulleted list unordered",
    command: (chain) => chain.toggleBulletList(),
  },
  {
    title: "Numbered List",
    icon: "1.",
    description: "Create a numbered list",
    keywords: "numbered ordered list",
    command: (chain) => chain.toggleOrderedList(),
  },
  {
    title: "To-do List",
    icon: "☐",
    description: "Track tasks with a checklist",
    keywords: "todo to-do task checklist",
    command: (chain) => chain.toggleTaskList(),
  },
  {
    title: "Quote",
    icon: "“",
    description: "Capture a quotation",
    keywords: "quote blockquote",
    command: (chain) => chain.toggleBlockquote(),
  },
  {
    title: "Code Block",
    icon: "</>",
    description: "Display code with formatting",
    keywords: "code pre",
    command: (chain) => chain.toggleCodeBlock(),
  },
  {
    title: "Divider",
    icon: "—",
    description: "Separate sections with a line",
    keywords: "divider horizontal rule",
    command: (chain) => chain.setHorizontalRule(),
  },
  {
    title: "Callout",
    icon: "✳",
    description: "Highlight an important note",
    keywords: "callout note",
    command: (chain) => chain.wrapIn("callout"),
  },
  {
    title: "Table",
    icon: "▦",
    description: "Insert a 3 × 3 table",
    keywords: "table grid rows columns spreadsheet",
    command: (chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: false }),
  },
];

export function createEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: false, underline: false,
    }),
    Underline,
    Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
    TextStyle,
    Color.configure({ types: ["textStyle"] }),
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({ placeholder: "Start writing, or type / for commands" }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Callout,
    Table.configure({
      resizable: true,
      cellMinWidth: 96,
      lastColumnResizable: true,
      allowTableNodeSelection: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}
