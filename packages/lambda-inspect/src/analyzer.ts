import ts from "typescript";
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
  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.Latest,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    allowJs: true,
  });

  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) {
    return [`Error: Could not parse source file ${filePath}`];
  }

  const checker = program.getTypeChecker();

  const expectedHandlerName = getExpectedHandlerName(filePath);

  const badPractices: string[] = [];

  function visit(node: ts.Node) {
    if (isHandler(node, expectedHandlerName)) {
      const res = checkHandlerBody(node, expectedHandlerName, checker);
      badPractices.push(...res);
    }

    badPractices.push(...checkImportForV2(node));

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return badPractices;
}
