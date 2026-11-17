import {
  mergeAttributes, Node, StarterKit, Underline, Link, TextStyle, Color,
  Highlight, Placeholder, TaskList, TaskItem, Table, TableRow, TableCell, TableHeader,
  Details, DetailsSummary, DetailsContent, Image,
} from "./vendor/editor.js?v=31";

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


const BodyImage = Image.extend({
  renderText({ node }) {
    return node.attrs.alt || "Image";
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("figure");
      dom.className = "editor-image";
      dom.contentEditable = "false";
      const image = document.createElement("img");
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      const failure = document.createElement("figcaption");
      failure.setAttribute("role", "status");
      failure.hidden = true;
      dom.append(image, failure);
      let source = null;
      const update = (current) => {
        image.alt = current.attrs.alt || "";
        image.title = current.attrs.title || "";
        failure.textContent = `Image couldn't load${current.attrs.alt ? `: ${current.attrs.alt}` : ". Check its HTTPS URL."}`;
        if (source !== current.attrs.src) {
          source = current.attrs.src;
          image.hidden = false;
          failure.hidden = true;
          image.src = source;
        }
      };
      image.addEventListener("error", () => { image.hidden = true; failure.hidden = false; dom.classList.add("image-failed"); });
      image.addEventListener("load", () => { image.hidden = false; failure.hidden = true; dom.classList.remove("image-failed"); });
      update(node);
      return {
        dom,
        update(current) { if (current.type.name !== "image") return false; update(current); return true; },
        ignoreMutation: (mutation) => mutation.type !== "selection",
        selectNode: () => dom.classList.add("ProseMirror-selectednode"),
        deselectNode: () => dom.classList.remove("ProseMirror-selectednode"),
      };
    };
  },
});

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
    Details.configure({
      persist: true,
      renderToggleButton: ({ element, isOpen }) => {
        element.contentEditable = "false";
        element.setAttribute("aria-label", isOpen ? "Collapse dropdown" : "Expand dropdown");
        element.setAttribute("aria-expanded", String(isOpen));
        element.textContent = "";
      },
    }),
    DetailsSummary.configure({ HTMLAttributes: { "aria-label": "Dropdown summary" } }),
    DetailsContent,
    BodyImage,
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
