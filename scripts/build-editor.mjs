import { build } from "esbuild";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const result = await build({
  entryPoints: ["src/editor/index.js"],
  outfile: "src/main/resources/static/vendor/editor.js",
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2022",
  legalComments: "linked",
  metafile: true,
});

const packages = new Set();
for (const input of Object.keys(result.metafile.inputs)) {
  const parts = input.split("/");
  const index = parts.lastIndexOf("node_modules");
  if (index === -1) continue;
  const length = parts[index + 1].startsWith("@") ? index + 3 : index + 2;
  packages.add(parts.slice(0, length).join("/"));
}
const notices = [];
for (const directory of [...packages].sort()) {
  const metadata = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
  const licenses = (await readdir(directory)).filter((name) => /^(license|copying)(\.|$)/i.test(name));
  const texts = await Promise.all(licenses.map((name) => readFile(path.join(directory, name), "utf8")));
  notices.push(`${metadata.name} ${metadata.version} (${metadata.license})\n${texts.join("\n")}`);
}
await writeFile("src/main/resources/static/vendor/editor.LICENSE.txt", notices.join("\n\n-----\n\n"));
