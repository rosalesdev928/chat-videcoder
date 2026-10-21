import { describe, expect, it } from "vitest";
import { getEditorLanguage } from "./editor-config";

describe("getEditorLanguage", () => {
  it.each([
    ["ts", "typescript"],
    ["tsx", "typescript"],
    ["JSX", "javascript"],
    ["json", "json"],
    ["md", "markdown"],
    ["py", "python"],
    ["yml", "yaml"],
  ])("maps .%s to %s", (extension, language) => {
    expect(getEditorLanguage(extension)).toBe(language);
  });

  it("falls back to plaintext for unknown or empty extensions", () => {
    expect(getEditorLanguage("unknownext")).toBe("plaintext");
    expect(getEditorLanguage("")).toBe("plaintext");
  });
});
