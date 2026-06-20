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

function isAwsSdkModule(moduleSpecifier: string): boolean {
  return moduleSpecifier.startsWith("@aws-sdk/") || moduleSpecifier === "aws-sdk";
}

function getLeftmostIdentifier(node: ts.Expression): ts.Identifier | null {
  if (ts.isIdentifier(node)) {
    return node;
  }
  if (ts.isPropertyAccessExpression(node)) {
    return getLeftmostIdentifier(node.expression);
  }
  return null;
}

function isAwsSdkClassName(className: string): boolean {
  const awsServiceNames = new Set([
    "S3",
    "DynamoDB",
    "Lambda",
    "SQS",
    "SNS",
    "EventBridge",
    "SecretsManager",
    "SecretManager",
    "SES",
    "Kinesis",
    "CloudWatch",
    "CloudWatchLogs",
    "StepFunctions",
    "CognitoIdentityServiceProvider",
    "CognitoIdentityProvider",
    "APIGateway",
    "STS",
    "SSM",
    "KMS",
    "IAM",
    "Athena",
    "Translate",
    "Rekognition",
    "CloudFront",
    "ECS",
    "EKS",
    "SFN",
    "Route53",
    "Redshift",
    "DocumentClient",
  ]);

  if (awsServiceNames.has(className)) {
    return true;
  }

  if (className.endsWith("Client")) {
    const servicePart = className.slice(0, -6);
    const nonAwsClients = new Set([
      "Http",
      "Mongo",
      "Redis",
      "Apollo",
      "Rest",
      "GraphQL",
      "Db",
      "Database",
      "Tcp",
      "Udp",
      "Websocket",
      "Ws",
    ]);
    if (nonAwsClients.has(servicePart)) {
      return false;
    }
    return true;
  }

  return false;
}

export function getHandlerNodes(
  sourceFile: ts.SourceFile,
  expectedHandlerName: string,
  checker?: ts.TypeChecker,
): ts.Node[] {
  if (checker) {
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (moduleSymbol) {
      const exports = checker.getExportsOfModule(moduleSymbol);
      let handlerExport = exports.find((exp) => exp.name === expectedHandlerName);
      if (handlerExport) {
        if ((handlerExport.flags & ts.SymbolFlags.Alias) !== 0) {
          try {
            const aliased = checker.getAliasedSymbol(handlerExport);
            if (aliased) {
              handlerExport = aliased;
            }
          } catch {
            // ignore
          }
        }
        const declarations = handlerExport.getDeclarations();
        if (declarations && declarations.length > 0) {
          return declarations;
        }
      }
    }
  }

  // Fallback to traversing AST for matching functions/variables
  const nodes: ts.Node[] = [];
  function visit(node: ts.Node) {
    if (isHandler(node, expectedHandlerName)) {
      nodes.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return nodes;
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

      let isAws = false;
      let hasResolvedSymbol = false;
      if (checker) {
        const leftmost = getLeftmostIdentifier(expression);
        if (leftmost) {
          let symbol = checker.getSymbolAtLocation(leftmost);
          if (symbol) {
            if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
              try {
                const aliased = checker.getAliasedSymbol(symbol);
                if (aliased) {
                  symbol = aliased;
                }
              } catch {
                // ignore
              }
            }
            const declarations = symbol.getDeclarations() || [];
            if (declarations.length > 0) {
              hasResolvedSymbol = true;
              for (const decl of declarations) {
                let parent: ts.Node | undefined = decl;
                while (parent) {
                  if (ts.isImportDeclaration(parent)) {
                    const moduleSpecifier = parent.moduleSpecifier;
                    if (
                      ts.isStringLiteral(moduleSpecifier) &&
                      isAwsSdkModule(moduleSpecifier.text)
                    ) {
                      isAws = true;
                      break;
                    }
                  }
                  parent = parent.parent;
                }
                if (isAws) break;

                // Check if required from AWS SDK
                if (ts.isVariableDeclaration(decl) && decl.initializer) {
                  if (
                    ts.isCallExpression(decl.initializer) &&
                    ts.isIdentifier(decl.initializer.expression) &&
                    decl.initializer.expression.text === "require" &&
                    decl.initializer.arguments.length > 0
                  ) {
                    const firstArg = decl.initializer.arguments[0];
                    if (ts.isStringLiteral(firstArg) && isAwsSdkModule(firstArg.text)) {
                      isAws = true;
                      break;
                    }
                  }
                } else if (ts.isBindingElement(decl)) {
                  let varDecl: ts.Node | undefined = decl;
                  while (varDecl && !ts.isVariableDeclaration(varDecl)) {
                    varDecl = varDecl.parent;
                  }
                  if (varDecl && ts.isVariableDeclaration(varDecl) && varDecl.initializer) {
                    const init = varDecl.initializer;
                    if (
                      ts.isCallExpression(init) &&
                      ts.isIdentifier(init.expression) &&
                      init.expression.text === "require" &&
                      init.arguments.length > 0
                    ) {
                      const firstArg = init.arguments[0];
                      if (ts.isStringLiteral(firstArg) && isAwsSdkModule(firstArg.text)) {
                        isAws = true;
                        break;
                      }
                    }
                  }
                }

                // Check if declaration is in node_modules/@aws-sdk/ or node_modules/aws-sdk/
                const sourceFile = decl.getSourceFile();
                if (sourceFile) {
                  const fileName = sourceFile.fileName;
                  if (
                    fileName.includes("node_modules/@aws-sdk/") ||
                    fileName.includes("node_modules/aws-sdk/")
                  ) {
                    isAws = true;
                    break;
                  }
                }
              }
            }
          }
        }
      }

      const shouldReport = hasResolvedSymbol ? isAws : isAwsSdkClassName(className);

      if (shouldReport) {
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
