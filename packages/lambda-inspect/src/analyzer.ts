import ts from "typescript";
import path from "node:path";

import { checkHandlerBody, checkImportForV2, getHandlerNodes, type Finding } from "./utils/ast";

function getExpectedHandlerName(filePath: string): string {
  const baseName = path.basename(filePath);
  const parts = baseName.split(".");
  if (parts.length >= 3) {
    return parts[parts.length - 2];
  }
  return "handler";
}

export async function analyzeLambda(filePath: string): Promise<Finding[]> {
  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.Latest,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    allowJs: true,
  });

  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) {
    return [
      {
        message: `Error: Could not parse source file ${filePath}`,
        file: path.relative(process.cwd(), filePath),
      },
    ];
  }

  const checker = program.getTypeChecker();

  const expectedHandlerName = getExpectedHandlerName(filePath);

  const badPractices: Finding[] = [];

  const handlerNodes = getHandlerNodes(sourceFile, expectedHandlerName, checker);
  for (const node of handlerNodes) {
    const res = checkHandlerBody(node, expectedHandlerName, checker);
    badPractices.push(...res);
  }

  function visit(node: ts.Node) {
    badPractices.push(...checkImportForV2(node));
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return badPractices;
}
