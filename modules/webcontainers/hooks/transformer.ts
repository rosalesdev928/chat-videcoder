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
