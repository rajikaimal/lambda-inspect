import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { analyzeLambda } from "./analyzer";
import fs from "node:fs";
import path from "node:path";

describe("analyzer", () => {
  const dir = path.join(__dirname, ".temp-tests");

  beforeAll(() => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  });

  afterAll(() => {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("should analyze lambda and find bad practices", async () => {
    const filePath = path.join(dir, "index.handler.ts");
    fs.writeFileSync(filePath, "export const handler = async () => { const s3 = new S3(); };");

    const results = await analyzeLambda(filePath);
    expect(results).toHaveLength(1);
    expect(results[0]).toContain("Instantiation of 'S3' inside handler 'handler'");
  });

  it("should extract handler name from file path", async () => {
    const filePath = path.join(dir, "index.main.ts");
    fs.writeFileSync(filePath, "export const main = async () => { const s3 = new S3(); };");

    const results = await analyzeLambda(filePath);
    expect(results).toHaveLength(1);
    expect(results[0]).toContain("Instantiation of 'S3' inside handler 'main'");
  });

  it("should find bad practices across modules", async () => {
    const helperPath = path.join(dir, "helper.ts");
    fs.writeFileSync(helperPath, "export function helper() { const s3 = new S3(); }");

    const filePath = path.join(dir, "cross.main.ts");
    fs.writeFileSync(
      filePath,
      "import { helper } from './helper';\nexport const main = async () => { helper(); };",
    );

    const results = await analyzeLambda(filePath);
    expect(results).toHaveLength(1);
    expect(results[0]).toContain("Instantiation of 'S3' inside handler 'main'");
  });
});
