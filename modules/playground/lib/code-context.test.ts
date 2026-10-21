import { describe, expect, it } from "vitest";
import {
  analyzeCodeContext,
  buildPrompt,
  detectAfterComment,
  detectFramework,
  detectIncompletePatterns,
  detectInClass,
  detectInFunction,
  detectLanguage,
  extractCodeFromResponse,
} from "./code-context";

describe("detectLanguage", () => {
  it("prefers the file extension", () => {
    expect(detectLanguage("def foo(): pass", "app.tsx")).toBe("TypeScript");
    expect(detectLanguage("", "main.go")).toBe("Go");
  });

  it("falls back to content heuristics", () => {
    expect(detectLanguage("interface User { name: string }")).toBe("TypeScript");
    expect(detectLanguage("def main():\n  pass")).toBe("Python");
    expect(detectLanguage("console.log(1)")).toBe("JavaScript");
  });
});

describe("detectFramework", () => {
  it.each([
    ["import React from 'react'", "React"],
    ["<template><div /></template>", "Vue"],
    ["import { Component } from '@angular/core'", "Angular"],
    ["import Link from 'next/link'", "Next.js"],
    ["const x = 1", "None"],
  ])("detects %s", (content, framework) => {
    expect(detectFramework(content)).toBe(framework);
  });
});

describe("structure detection", () => {
  it("detects when the cursor is inside a function or class", () => {
    const lines = ["class Store {", "  function add() {", "    "];

    expect(detectInFunction(lines, 2)).toBe(true);
    expect(detectInClass(lines, 2)).toBe(true);
    expect(detectInFunction(["const x = 1;", "}", ""], 2)).toBe(false);
  });

  it("detects comments before the cursor", () => {
    expect(detectAfterComment("// TODO: ", 9)).toBe(true);
    expect(detectAfterComment("const a = 1;", 12)).toBe(false);
  });

  it("detects incomplete patterns before the cursor", () => {
    expect(detectIncompletePatterns("const user = {", 14)).toContain("object");
    expect(detectIncompletePatterns("const total = ", 14)).toContain("assignment");
    expect(detectIncompletePatterns("console.", 8)).toContain("method-call");
    expect(detectIncompletePatterns("const list = [", 14)).toContain("array");
  });
});

describe("analyzeCodeContext / buildPrompt", () => {
  const content = [
    "import { useState } from 'react'",
    "function Counter() {",
    "  const [count, setCount] = useState(0)",
    "  return count",
    "}",
  ].join("\n");

  it("collects the context around the cursor", () => {
    const context = analyzeCodeContext(content, 3, 9, "Counter.tsx");

    expect(context.language).toBe("TypeScript");
    expect(context.framework).toBe("React");
    expect(context.currentLine).toBe("  return count");
    expect(context.beforeContext).toContain("useState(0)");
    expect(context.afterContext).toBe("}");
    expect(context.isInFunction).toBe(true);
  });

  it("marks the cursor position in the prompt", () => {
    const prompt = buildPrompt(analyzeCodeContext(content, 3, 9, "Counter.tsx"), "completion");

    expect(prompt).toContain("Generate a completion suggestion");
    expect(prompt).toContain("  return |CURSOR|count");
  });
});

describe("extractCodeFromResponse", () => {
  it("returns plain code untouched", () => {
    expect(extractCodeFromResponse("return a + b;")).toBe("return a + b;");
  });

  it("extracts the code from a markdown fence", () => {
    expect(extractCodeFromResponse("Here you go:\n```ts\nreturn a + b;\n```")).toBe(
      "return a + b;"
    );
  });
});
