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
    expect(results[0].message).toContain("Instantiation of 'S3' inside handler 'handler'");
  });

  it("should extract handler name from file path", async () => {
    const filePath = path.join(dir, "index.main.ts");
    fs.writeFileSync(filePath, "export const main = async () => { const s3 = new S3(); };");

    const results = await analyzeLambda(filePath);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("Instantiation of 'S3' inside handler 'main'");
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
    expect(results[0].message).toContain("Instantiation of 'S3' inside handler 'main'");
  });

  it("should find bad practices across modules with arrow function helper", async () => {
    const helperPath = path.join(dir, "helper-arrow.ts");
    fs.writeFileSync(helperPath, "export const helperArrow = () => { const s3 = new S3(); };");

    const filePath = path.join(dir, "cross-arrow.main.ts");
    fs.writeFileSync(
      filePath,
      "import { helperArrow } from './helper-arrow';\nexport const main = async () => { helperArrow(); };",
    );

    const results = await analyzeLambda(filePath);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("Instantiation of 'S3' inside handler 'main'");
  });

  it("should detect handler with indirect export", async () => {
    const filePath = path.join(dir, "indirect.handler.ts");
    fs.writeFileSync(filePath, "function handler() { const s3 = new S3(); }\nexport { handler };");

    const results = await analyzeLambda(filePath);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("Instantiation of 'S3' inside handler 'handler'");
  });

  it("should detect AWS SDK v2 client CognitoIdentityServiceProvider", async () => {
    const filePath = path.join(dir, "cognito.handler.ts");
    fs.writeFileSync(
      filePath,
      "import AWS from 'aws-sdk';\nexport const handler = () => { new AWS.CognitoIdentityServiceProvider(); };",
    );

    const results = await analyzeLambda(filePath);
    // Should detect the import of 'aws-sdk' (AWS SDK v2 bad practice) AND the instantiation inside the handler
    expect(results.length).toBeGreaterThanOrEqual(2);
    const hasCognitoFinding = results.some((r) =>
      r.message.includes("CognitoIdentityServiceProvider"),
    );
    expect(hasCognitoFinding).toBe(true);
  });

  it("should NOT detect non-AWS SDK client like MongoClient", async () => {
    const filePath = path.join(dir, "mongo.handler.ts");
    fs.writeFileSync(
      filePath,
      "import { MongoClient } from 'mongodb';\nexport const handler = () => { new MongoClient('mongodb://localhost'); };",
    );

    const results = await analyzeLambda(filePath);
    // Should not flag MongoClient instantiation (only AWS SDK clients)
    const hasMongoFinding = results.some((r) => r.message.includes("MongoClient"));
    expect(hasMongoFinding).toBe(false);
  });
});
