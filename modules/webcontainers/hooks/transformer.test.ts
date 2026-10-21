import { describe, expect, it } from "vitest";
import type { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import {
  getFileName,
  getRootPackageJson,
  getStartScript,
  transformToWebContainerFormat,
} from "./transformer";

describe("transformToWebContainerFormat", () => {
  it("converts the template JSON into a WebContainer file tree", () => {
    const template: TemplateFolder = {
      folderName: "react-ts",
      items: [
        { filename: "package", fileExtension: "json", content: "{}" },
        { filename: ".gitignore", fileExtension: "", content: "node_modules" },
        {
          folderName: "src",
          items: [{ filename: "index", fileExtension: "tsx", content: "render()" }],
        },
      ],
    };

    expect(transformToWebContainerFormat(template)).toEqual({
      "package.json": { file: { contents: "{}" } },
      ".gitignore": { file: { contents: "node_modules" } },
      src: { directory: { "index.tsx": { file: { contents: "render()" } } } },
    });
  });
});

describe("getFileName", () => {
  it("omits the dot for files without extension", () => {
    expect(getFileName({ filename: "Dockerfile", fileExtension: "", content: "" })).toBe(
      "Dockerfile"
    );
  });
});

describe("getStartScript", () => {
  const pkg = (scripts: Record<string, string>) => JSON.stringify({ scripts });

  it("prefers dev, then start, then serve", () => {
    expect(getStartScript(pkg({ dev: "next dev", start: "next start" }))).toBe("dev");
    expect(getStartScript(pkg({ start: "react-scripts start" }))).toBe("start");
    expect(getStartScript(pkg({ serve: "vue-cli-service serve", build: "x" }))).toBe("serve");
  });

  it("defaults to start for missing or invalid package.json", () => {
    expect(getStartScript(undefined)).toBe("start");
    expect(getStartScript("{ not json")).toBe("start");
  });
});

describe("getRootPackageJson", () => {
  it("returns the root package.json content only", () => {
    const template: TemplateFolder = {
      folderName: "root",
      items: [
        { folderName: "sub", items: [{ filename: "package", fileExtension: "json", content: "nested" }] },
        { filename: "package", fileExtension: "json", content: "root" },
      ],
    };

    expect(getRootPackageJson(template)).toBe("root");
    expect(getRootPackageJson({ folderName: "empty", items: [] })).toBeUndefined();
  });
});
