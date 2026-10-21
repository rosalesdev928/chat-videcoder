import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getStartScript } from "@/modules/webcontainers/hooks/transformer";
import { templatePaths } from "./template";

// Must match `enum Templates` in prisma/schema.prisma
const TEMPLATES = ["REACT", "NEXTJS", "EXPRESS", "VUE", "HONO", "ANGULAR"];

describe("templatePaths", () => {
  it("has a path for every template in the Prisma schema", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const enumBody = schema.match(/enum Templates \{([^}]*)\}/)?.[1] ?? "";
    const schemaTemplates = enumBody.split(/\s+/).filter(Boolean);

    expect(schemaTemplates.sort()).toEqual([...TEMPLATES].sort());
    expect(Object.keys(templatePaths).sort()).toEqual([...TEMPLATES].sort());
  });

  it.each(Object.entries(templatePaths))(
    "%s points to a starter with a package.json and a dev-server script",
    (_, templatePath) => {
      const packageJsonPath = path.join(process.cwd(), templatePath, "package.json");

      expect(fs.existsSync(packageJsonPath)).toBe(true);
      // The WebContainer preview runs `npm run <getStartScript()>`
      const content = fs.readFileSync(packageJsonPath, "utf8");
      const script = getStartScript(content);
      expect(JSON.parse(content).scripts?.[script]).toBeTruthy();
    }
  );
});
