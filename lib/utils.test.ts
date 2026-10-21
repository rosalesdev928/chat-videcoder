import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins class names and skips falsy values", () => {
    const isHidden = false;
    expect(cn("px-2", isHidden && "hidden", undefined, "font-bold")).toBe("px-2 font-bold");
  });

  it("lets later Tailwind classes override conflicting ones", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
