import { describe, it, expect } from "vitest";
import ts from "typescript";
import { isHandler, checkHandlerBody, checkImportForV2, type Finding } from "./ast";

describe("ast utils", () => {
  describe("isHandler", () => {
    it("should identify exported function declaration", () => {
      const sourceFile = ts.createSourceFile(
        "test.ts",
        "export function handler() {}",
        ts.ScriptTarget.Latest,
        true,
      );
      const isH = isHandler(sourceFile.statements[0], "handler");
      expect(isH).toBe(true);
    });

    it("should not identify non-exported function declaration", () => {
      const sourceFile = ts.createSourceFile(
        "test.ts",
        "function handler() {}",
        ts.ScriptTarget.Latest,
        true,
      );
      const isH = isHandler(sourceFile.statements[0], "handler");
      expect(isH).toBe(false);
    });

    it("should identify exported arrow function", () => {
      const sourceFile = ts.createSourceFile(
        "test.ts",
        "export const handler = () => {}",
        ts.ScriptTarget.Latest,
        true,
      );
      const isH = isHandler(sourceFile.statements[0], "handler");
      expect(isH).toBe(true);
    });

    it("should match handler name", () => {
      const sourceFile = ts.createSourceFile(
        "test.ts",
        "export const main = () => {}",
        ts.ScriptTarget.Latest,
        true,
      );
      expect(isHandler(sourceFile.statements[0], "main")).toBe(true);
      expect(isHandler(sourceFile.statements[0], "handler")).toBe(false);
    });
  });

  describe("checkHandlerBody", () => {
    it("should detect heavy lib instantiations in handler body (arrow function)", () => {
      const sourceFile = ts.createSourceFile(
        "test.ts",
        "export const handler = () => { const s3 = new S3(); }",
        ts.ScriptTarget.Latest,
        true,
      );

      const badPractices = checkHandlerBody(sourceFile.statements[0], "handler");
      expect(badPractices).toHaveLength(1);
      expect(badPractices[0].message).toContain("Instantiation of 'S3' inside handler 'handler'");
    });

    it("should detect heavy lib instantiations in handler body (function declaration)", () => {
      const sourceFile = ts.createSourceFile(
        "test.ts",
        "export function handler() { const dynamodb = new DynamoDB(); }",
        ts.ScriptTarget.Latest,
        true,
      );

      const badPractices = checkHandlerBody(sourceFile.statements[0], "handler");
      expect(badPractices).toHaveLength(1);
      expect(badPractices[0].message).toContain(
        "Instantiation of 'DynamoDB' inside handler 'handler'",
      );
    });

    it("should ignore heavy lib instantiations outside handler body", () => {
      const sourceFile = ts.createSourceFile(
        "test.ts",
        "const s3 = new S3(); export const handler = () => {}",
        ts.ScriptTarget.Latest,
        true,
      );

      const badPractices = checkHandlerBody(sourceFile.statements[1], "handler");
      expect(badPractices).toHaveLength(0);
    });
  });

  describe("checkImportForV2", () => {
    it("should detect import of aws-sdk", () => {
      const sourceFile = ts.createSourceFile(
        "test.ts",
        "import AWS from 'aws-sdk';",
        ts.ScriptTarget.Latest,
        true,
      );
      const badPractices = checkImportForV2(sourceFile.statements[0]);
      expect(badPractices).toHaveLength(1);
      expect(badPractices[0].message).toContain("Importing 'aws-sdk'");
    });

    it("should detect require of aws-sdk", () => {
      const sourceFile = ts.createSourceFile(
        "test.ts",
        "const AWS = require('aws-sdk');",
        ts.ScriptTarget.Latest,
        true,
      );

      // Need to traverse to the call expression
      const practices: Finding[] = [];
      function visit(node: ts.Node) {
        practices.push(...checkImportForV2(node));
        ts.forEachChild(node, visit);
      }
      visit(sourceFile);

      expect(practices).toHaveLength(1);
      expect(practices[0].message).toContain("Requiring 'aws-sdk'");
    });

    it("should not detect AWS SDK v3 imports", () => {
      const sourceFile = ts.createSourceFile(
        "test.ts",
        "import { S3Client } from '@aws-sdk/client-s3';",
        ts.ScriptTarget.Latest,
        true,
      );
      const badPractices = checkImportForV2(sourceFile.statements[0]);
      expect(badPractices).toHaveLength(0);
    });
  });
});
