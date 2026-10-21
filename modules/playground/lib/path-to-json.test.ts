import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  readTemplateStructureFromJson,
  saveTemplateStructureToJson,
  scanTemplateDirectory,
  type TemplateFile,
  type TemplateFolder,
} from "./path-to-json";

let root: string;

async function write(relativePath: string, content: string) {
  const fullPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content);
}

function names(folder: TemplateFolder): string[] {
  return folder.items.map((item) =>
    "folderName" in item ? `${item.folderName}/` : `${item.filename}.${item.fileExtension}`
  );
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "template-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("scanTemplateDirectory", () => {
  it("builds a nested tree with file contents", async () => {
    await write("package.json", '{"name":"demo"}');
    await write("src/App.tsx", "export default function App() {}");

    const tree = await scanTemplateDirectory(root);

    expect(tree.folderName).toBe(path.basename(root));
    expect(names(tree).sort()).toEqual(["package.json", "src/"]);

    const src = tree.items.find((item) => "folderName" in item) as TemplateFolder;
    expect(src.items[0]).toEqual<TemplateFile>({
      filename: "App",
      fileExtension: "tsx",
      content: "export default function App() {}",
    });
  });

  it("skips ignored folders, files and patterns", async () => {
    await write("index.js", "console.log(1)");
    await write("node_modules/react/index.js", "module.exports = {}");
    await write(".git/HEAD", "ref: refs/heads/main");
    await write("package-lock.json", "{}");
    await write(".env", "SECRET=1");
    await write("notes.txt~", "backup");

    const tree = await scanTemplateDirectory(root);

    expect(names(tree)).toEqual(["index.js"]);
  });

  it("accepts extra ignore options", async () => {
    await write("README.md", "# docs");
    await write("docs/guide.md", "guide");
    await write("main.ts", "export {}");

    const tree = await scanTemplateDirectory(root, {
      ignoreFiles: ["README.md"],
      ignoreFolders: ["docs"],
    });

    expect(names(tree)).toEqual(["main.ts"]);
  });

  it("replaces the content of files over maxFileSize with a placeholder", async () => {
    await write("big.txt", "x".repeat(100));

    const tree = await scanTemplateDirectory(root, { maxFileSize: 10 });
    const file = tree.items[0] as TemplateFile;

    expect(file.content).toMatch(/File content not included/);
  });

  it("fails clearly when the directory does not exist", async () => {
    await expect(scanTemplateDirectory(path.join(root, "missing"))).rejects.toThrow(
      /does not exist/
    );
    await expect(scanTemplateDirectory("")).rejects.toThrow(/required/);
  });
});

describe("saveTemplateStructureToJson / readTemplateStructureFromJson", () => {
  it("round-trips the template structure through a JSON file", async () => {
    await write("template/index.html", "<h1>Hi</h1>");
    const output = path.join(root, "out", "template.json");

    await saveTemplateStructureToJson(path.join(root, "template"), output);
    const result = await readTemplateStructureFromJson(output);

    expect(result).toEqual(await scanTemplateDirectory(path.join(root, "template")));
  });
});
