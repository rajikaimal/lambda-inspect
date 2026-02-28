# Lambda Inspect

A tool to inspect AWS Lambda functions for bad practices and unused files. It specifically detects issues like re-used libraries instantiated inside handler functions and uses [Knip](https://knip.dev/) to find unused files.

Made with Google Antigravity.

## Features

- **Bad Practice Detection**: Identifies libraries instantiated inside the handler that should be in the global scope for better performance (e.g., AWS SDK clients, database connections).
- **Unused File Detection**: Integrates with Knip to find files that are not being used in your project.

# Install

```bash
npx lambda-inspect@latest <path-to-handler>
```

# Install Agent Skill

```bash
curl -fsSL https://raw.githubusercontent.com/rajikaimal/lambda-inspect/main/install-skill.sh | bash
```

## Usage

After building the project, you can run the CLI using:

```bash
$ lambda-inspect <path-to-handler>
$ lambda-inspect <path-to-handler> --skip-unused-files
```

### Options

- `--skip-unused-files`: Skip unused files detection (default: `false`).

## Development

### Prerequisites

- Node.js (>= 22)
- pnpm

### Getting Started

Install dependencies:

```bash
pnpm install
```

### Commands

| Command        | Description                        |
| -------------- | ---------------------------------- |
| `pnpm build`   | Build the project                  |
| `pnpm dev`     | Run in development mode with watch |
| `pnpm test`    | Run tests                          |
| `pnpm lint`    | Run linting (using oxlint)         |
| `pnpm format`  | Format code (using oxfmt)          |
| `pnpm knip`    | Run Knip analysis                  |
| `pnpm publish` | Publish to NPM                     |

## License

MIT
