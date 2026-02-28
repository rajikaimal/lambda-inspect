import ts from "typescript";
import path from "node:path";

export interface Finding {
  message: string;
  file: string;
}

export function isHandler(node: ts.Node, expectedHandlerName: string): boolean {
  if (ts.isFunctionDeclaration(node)) {
    const isExported = (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0;
    const nameMatches = node.name?.text === expectedHandlerName;
    return isExported && nameMatches;
  }
  if (ts.isVariableStatement(node)) {
    const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    if (!isExported) return false;

    return node.declarationList.declarations.some((decl) => {
      return ts.isIdentifier(decl.name) && decl.name.text === expectedHandlerName;
    });
  }
  return false;
}

export function checkHandlerBody(
  node: ts.Node,
  handlerName: string,
  checker?: ts.TypeChecker,
  visited = new Set<ts.Node>(),
): Finding[] {
  const badPractices: Finding[] = [];

  if (visited.has(node)) {
    return badPractices;
  }
  visited.add(node);

  const filePath = node.getSourceFile().fileName;
  let relativePath = path.relative(process.cwd(), filePath);
  if (!relativePath.startsWith(".") && !path.isAbsolute(relativePath)) {
    relativePath = `./${relativePath}`;
  }

  function checkBody(child: ts.Node) {
    if (ts.isNewExpression(child)) {
      const expression = child.expression;

      const className = (() => {
        if (ts.isIdentifier(expression)) return expression.text;
        if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
        return "";
      })();

      const suspicious = ["Client", "Service", "DB", "Connection", "Driver"];
      const knownLibs = ["S3", "DynamoDB", "Lambda", "SQS", "SNS", "EventBridge", "SecretManager"];

      if (suspicious.some((s) => className.endsWith(s)) || knownLibs.includes(className)) {
        badPractices.push({
          message: `Instantiation of '${className}' inside handler '${handlerName}'. Move this outside the handler to benefit from execution environment reuse`,
          file: relativePath,
        });
      }
    } else if (ts.isCallExpression(child) && checker) {
      const signature = checker.getResolvedSignature(child);
      if (signature) {
        const declaration = signature.getDeclaration();
        if (declaration) {
          const sourceFile = declaration.getSourceFile();
          if (sourceFile && !sourceFile.fileName.includes("node_modules")) {
            badPractices.push(...checkHandlerBody(declaration, handlerName, checker, visited));
          }
        }
      }
    }
    ts.forEachChild(child, checkBody);
  }

  if (ts.isVariableStatement(node)) {
    node.declarationList.declarations.forEach((decl) => {
      if (decl.initializer) {
        ts.forEachChild(decl.initializer, checkBody);
      }
    });
  } else {
    ts.forEachChild(node, checkBody);
  }

  return badPractices;
}

export function checkImportForV2(node: ts.Node): Finding[] {
  const badPractices: Finding[] = [];
  const filePath = node.getSourceFile().fileName;
  let relativePath = path.relative(process.cwd(), filePath);
  if (!relativePath.startsWith(".") && !path.isAbsolute(relativePath)) {
    relativePath = `./${relativePath}`;
  }

  if (ts.isImportDeclaration(node)) {
    if (ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "aws-sdk") {
      badPractices.push({
        message:
          "Importing 'aws-sdk' (AWS SDK v2) is a bad practice. Use AWS SDK v3 (e.g., '@aws-sdk/client-s3') to reduce bundle size",
        file: relativePath,
      });
    }
  }

  if (ts.isCallExpression(node)) {
    if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
      const args = node.arguments;
      if (args.length > 0 && ts.isStringLiteral(args[0]) && args[0].text === "aws-sdk") {
        badPractices.push({
          message:
            "Requiring 'aws-sdk' (AWS SDK v2) is a bad practice. Use AWS SDK v3 (e.g., '@aws-sdk/client-s3') to reduce bundle size",
          file: relativePath,
        });
      }
    }
  }

  return badPractices;
}
