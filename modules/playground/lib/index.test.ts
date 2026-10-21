import { describe, expect, it } from "vitest";
import { findFilePath, generateFileId } from "./index";
import type { TemplateFile, TemplateFolder } from "./path-to-json";

const file = (filename: string, fileExtension: string): TemplateFile => ({
  filename,
  fileExtension,
  content: "",
});

const root: TemplateFolder = {
  folderName: "Root",
  items: [
    file("package", "json"),
    {
      folderName: "src",
      items: [file("App", "tsx"), { folderName: "components", items: [file("Button", "tsx")] }],
    },
    file("Dockerfile", ""),
  ],
};

describe("findFilePath", () => {
  it("returns the path of a file relative to the root", () => {
    expect(findFilePath(file("package", "json"), root)).toBe("package.json");
    expect(findFilePath(file("Button", "tsx"), root)).toBe("src/components/Button.tsx");
  });

  it("handles files without extension", () => {
    expect(findFilePath(file("Dockerfile", ""), root)).toBe("Dockerfile");
  });

  it("returns null when the file is not in the tree", () => {
    expect(findFilePath(file("missing", "ts"), root)).toBeNull();
  });
});

describe("generateFileId", () => {
  it("uses the file path as id", () => {
    expect(generateFileId(file("App", "tsx"), root)).toBe("src/App.tsx");
  });

  it("falls back to the file name when the file is not in the tree", () => {
    expect(generateFileId(file("new", "ts"), root)).toBe("new.ts");
    expect(generateFileId(file("Makefile", ""), root)).toBe("Makefile");
  });
});
