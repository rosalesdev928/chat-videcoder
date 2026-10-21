import type { FileSystemTree } from "@webcontainer/api";
import type {
  TemplateFile,
  TemplateFolder,
  TemplateItem,
} from "@/modules/playground/lib/path-to-json";

function isFolder(item: TemplateItem): item is TemplateFolder {
  return "folderName" in item;
}

/** File name as it appears on disk. Dotfiles like `.gitignore` have no extension. */
export function getFileName(file: TemplateFile): string {
  return file.fileExtension
    ? `${file.filename}.${file.fileExtension}`
    : file.filename;
}

function toTree(items: TemplateItem[]): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const item of items) {
    if (isFolder(item)) {
      tree[item.folderName] = { directory: toTree(item.items) };
    } else {
      tree[getFileName(item)] = { file: { contents: item.content } };
    }
  }

  return tree;
}

/** Converts the template JSON into the tree that `WebContainer.mount()` expects */
export function transformToWebContainerFormat(
  template: TemplateFolder
): FileSystemTree {
  return toTree(template.items);
}

// Dev-server scripts in order of preference. `start` is not first because in
// some templates (e.g. Next.js) it serves a production build that doesn't exist yet.
const START_SCRIPTS = ["dev", "start", "serve"] as const;

/** Picks the npm script that starts the template's dev server */
export function getStartScript(packageJsonContent: string | undefined): string {
  try {
    const scripts = JSON.parse(packageJsonContent ?? "{}").scripts ?? {};
    return START_SCRIPTS.find((name) => typeof scripts[name] === "string") ?? "start";
  } catch {
    return "start";
  }
}

/** Content of the root package.json of a template, if any */
export function getRootPackageJson(template: TemplateFolder): string | undefined {
  const file = template.items.find(
    (item): item is TemplateFile =>
      !isFolder(item) && item.filename === "package" && item.fileExtension === "json"
  );
  return file?.content;
}
