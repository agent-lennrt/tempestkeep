import { build } from "esbuild";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = `${root}internal/mcpapp/ui/`;
const version = (await readFile(`${root}internal/version/VERSION`, "utf8")).trim();
const result = await build({
  absWorkingDir: root,
  entryPoints: ["internal/mcpapp/ui/app.js"],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  legalComments: "inline",
  metafile: true,
  define: { __TEMPESTKEEP_VERSION__: JSON.stringify(version) },
  write: false,
});
const template = await readFile(`${directory}template.html`, "utf8");
const css = await readFile(`${directory}style.css`, "utf8");
// Escape HTML script terminators even when they occur inside bundled strings.
const javascript = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
// Carry the licenses of every bundled dependency into the Go binary. esbuild's
// legalComments covers source headers, but packages also ship license files.
const packages = [...new Set(Object.keys(result.metafile.inputs).map(path => path.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean))].sort();
const notices = [];
for (const name of packages) {
  const packageRoot = `${root}node_modules/${name}/`;
  const metadata = JSON.parse(await readFile(`${packageRoot}package.json`, "utf8"));
  const files = (await readdir(packageRoot)).filter(name => /^(licen[cs]e|notice)(\.|$)/i.test(name)).sort();
  if (!files.length) throw new Error(`Bundled package ${name} has no license file.`);
  for (const filename of files) {
    const license = (await readFile(`${packageRoot}${filename}`, "utf8")).replace(/[ \t]+$/gm, "");
    notices.push(`${name}@${metadata.version} — ${filename}\n\n${license}`);
  }
}
const licenses = `<!-- Bundled third-party licenses\n\n${notices.join("\n\n").replace(/-->/g, "--&gt;")}\n-->\n`;
// Function replacements keep JavaScript's $&, $` and $' sequences literal.
const html = template.replace("/* APP_STYLES */", () => css).replace("/* APP_SCRIPT */", () => javascript).replace("</head>", () => `${licenses}</head>`);
const destination = `${directory}app.html`;
if (process.argv.includes("--check")) {
  if (await readFile(destination, "utf8") !== html) {
    throw new Error("MCP App bundle is stale. Run npm run app:build and commit app.html.");
  }
  console.log("MCP App bundle matches its sources.");
} else {
  await writeFile(destination, html);
  console.log(`Built MCP App (${Math.round(Buffer.byteLength(html) / 1024)} KiB).`);
}
