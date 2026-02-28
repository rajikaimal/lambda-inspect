---
name: lambda-inspect
description: Analyzes AWS Lambda TypeScript/JavaScript code for performance anti-patterns and unused files. Run when developing handlers or optimizing cold starts.
---

# Lambda Inspect

Scans your AWS Lambda handlers for performance anti-patterns (like internal library instantiations) and project-wide unused files using Knip.

## Usage

```bash
npx -y lambda-inspect@latest <path-to-handler>
```

## Workflow

Run when developing or refactoring Lambda handlers. Move heavy library instantiations (AWS SDK, DB clients) outside the handler to benefit from execution environment reuse and reduce cold starts.
