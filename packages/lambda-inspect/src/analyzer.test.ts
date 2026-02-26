import { describe, it, expect, vi } from "vitest";
import { analyzeLambda } from "./analyzer";
import fs from "node:fs";

vi.mock("node:fs", () => ({
  default: {
    readFileSync: vi.fn(),
  },
  readFileSync: vi.fn(),
}));

describe("analyzer", () => {
  it("should analyze lambda and find bad practices", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue("export const handler = async () => { const s3 = new S3(); };");
    
    const results = await analyzeLambda("/path/to/index.handler.ts");
    expect(results).toHaveLength(1);
    expect(results[0]).toContain("Instantiation of 'S3' inside handler 'handler'");
  });
  
  it("should extract handler name from file path", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue("export const main = async () => { const s3 = new S3(); };");
    
    const results = await analyzeLambda("/path/to/index.main.ts");
    expect(results).toHaveLength(1);
    expect(results[0]).toContain("Instantiation of 'S3' inside handler 'main'");
  });
});
