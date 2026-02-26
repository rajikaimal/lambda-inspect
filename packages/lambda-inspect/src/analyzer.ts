import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

import { isHandler, checkHandlerBody, checkImportForV2 } from "./utils/ast";

function getExpectedHandlerName(filePath: string): string {
  const baseName = path.basename(filePath);
  const parts = baseName.split(".");
  if (parts.length >= 3) {
    return parts[parts.length - 2];
  }
  return "handler";
}

export async function analyzeLambda(filePath: string): Promise<string[]> {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);
  
  const expectedHandlerName = getExpectedHandlerName(filePath);

  const badPractices: string[] = [];

  function visit(node: ts.Node) {
    if (isHandler(node, expectedHandlerName)) {
      const res = checkHandlerBody(node, expectedHandlerName);
      badPractices.push(...res);
    }
    
    badPractices.push(...checkImportForV2(node));

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return badPractices;
}
