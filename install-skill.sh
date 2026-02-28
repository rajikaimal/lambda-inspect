#!/bin/bash
set -e

if [ -t 1 ]; then
  GREEN='\033[32m'
  DIM='\033[2m'
  RESET='\033[0m'
else
  GREEN=''
  DIM=''
  RESET=''
fi

SKILL_NAME="lambda-inspect"
INSTALLED=0

SKILL_CONTENT=$(cat << 'EOF'
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
EOF
)

AGENTS_CONTENT=$(cat << 'EOF'
Analyzes AWS Lambda TypeScript/JavaScript code for performance anti-patterns and unused files. Run when developing handlers or optimizing cold starts.

Scans your AWS Lambda handlers for performance anti-patterns (like internal library instantiations) and project-wide unused files using Knip.
EOF
)

echo "Installing Lambda Inspect skill..."
echo ""

# Claude Code
if [ -d "$HOME/.claude" ]; then
  SKILL_DIR="$HOME/.claude/skills/$SKILL_NAME"
  mkdir -p "$SKILL_DIR"
  printf '%s\n' "$SKILL_CONTENT" > "$SKILL_DIR/SKILL.md"
  printf '%s\n' "$AGENTS_CONTENT" > "$SKILL_DIR/AGENTS.md"
  printf "${GREEN}✔${RESET} Claude Code\n"
  INSTALLED=$((INSTALLED + 1))
fi

# Amp Code
if [ -d "$HOME/.amp" ]; then
  SKILL_DIR="$HOME/.config/amp/skills/$SKILL_NAME"
  mkdir -p "$SKILL_DIR"
  printf '%s\n' "$SKILL_CONTENT" > "$SKILL_DIR/SKILL.md"
  printf '%s\n' "$AGENTS_CONTENT" > "$SKILL_DIR/AGENTS.md"
  printf "${GREEN}✔${RESET} Amp Code\n"
  INSTALLED=$((INSTALLED + 1))
fi

# Cursor
if [ -d "$HOME/.cursor" ]; then
  SKILL_DIR="$HOME/.cursor/skills/$SKILL_NAME"
  mkdir -p "$SKILL_DIR"
  printf '%s\n' "$SKILL_CONTENT" > "$SKILL_DIR/SKILL.md"
  printf '%s\n' "$AGENTS_CONTENT" > "$SKILL_DIR/AGENTS.md"
  printf "${GREEN}✔${RESET} Cursor\n"
  INSTALLED=$((INSTALLED + 1))
fi

# OpenCode
if command -v opencode &> /dev/null || [ -d "$HOME/.config/opencode" ]; then
  SKILL_DIR="$HOME/.config/opencode/skills/$SKILL_NAME"
  mkdir -p "$SKILL_DIR"
  printf '%s\n' "$SKILL_CONTENT" > "$SKILL_DIR/SKILL.md"
  printf '%s\n' "$AGENTS_CONTENT" > "$SKILL_DIR/AGENTS.md"
  printf "${GREEN}✔${RESET} OpenCode\n"
  INSTALLED=$((INSTALLED + 1))
fi

# Windsurf
MARKER="# Lambda Inspect"
if [ -d "$HOME/.codeium" ] || [ -d "$HOME/Library/Application Support/Windsurf" ]; then
  mkdir -p "$HOME/.codeium/windsurf/memories"
  RULES_FILE="$HOME/.codeium/windsurf/memories/global_rules.md"
  if [ -f "$RULES_FILE" ] && grep -q "$MARKER" "$RULES_FILE"; then
    printf "${GREEN}✔${RESET} Windsurf ${DIM}(already installed)${RESET}\n"
  else
    if [ -f "$RULES_FILE" ]; then
      echo "" >> "$RULES_FILE"
    fi
    echo "$MARKER" >> "$RULES_FILE"
    echo "" >> "$RULES_FILE"
    printf '%s\n' "$SKILL_CONTENT" >> "$RULES_FILE"
    printf "${GREEN}✔${RESET} Windsurf\n"
  fi
  INSTALLED=$((INSTALLED + 1))
fi

# Antigravity
if command -v agy &> /dev/null || [ -d "$HOME/.gemini/antigravity" ]; then
  SKILL_DIR="$HOME/.gemini/antigravity/skills/$SKILL_NAME"
  mkdir -p "$SKILL_DIR"
  printf '%s\n' "$SKILL_CONTENT" > "$SKILL_DIR/SKILL.md"
  printf '%s\n' "$AGENTS_CONTENT" > "$SKILL_DIR/AGENTS.md"
  printf "${GREEN}✔${RESET} Antigravity\n"
  INSTALLED=$((INSTALLED + 1))
fi

# Gemini CLI
if command -v gemini &> /dev/null || [ -d "$HOME/.gemini" ]; then
  mkdir -p "$HOME/.gemini/skills/$SKILL_NAME"
  printf '%s\n' "$SKILL_CONTENT" > "$HOME/.gemini/skills/$SKILL_NAME/SKILL.md"
  printf '%s\n' "$AGENTS_CONTENT" > "$HOME/.gemini/skills/$SKILL_NAME/AGENTS.md"
  printf "${GREEN}✔${RESET} Gemini CLI\n"
  INSTALLED=$((INSTALLED + 1))
fi

# Project-level .agents/
AGENTS_DIR=".agents/$SKILL_NAME"
mkdir -p "$AGENTS_DIR"
printf '%s\n' "$SKILL_CONTENT" > "$AGENTS_DIR/SKILL.md"
printf '%s\n' "$AGENTS_CONTENT" > "$AGENTS_DIR/AGENTS.md"
printf "${GREEN}✔${RESET} .agents/\n"
INSTALLED=$((INSTALLED + 1))

echo ""
if [ $INSTALLED -eq 0 ]; then
  echo "No supported tools detected."
  echo ""
  echo "Install one of these first:"
  echo "  • Amp Code: https://ampcode.com"
  echo "  • Antigravity: https://antigravity.google"
  echo "  • Claude Code: https://claude.ai/code"
  echo "  • Cursor: https://cursor.com"
  echo "  • Gemini CLI: https://github.com/google-gemini/gemini-cli"
  echo "  • OpenCode: https://opencode.ai"
  echo "  • Windsurf: https://codeium.com/windsurf"
  exit 1
fi

echo "Done! Lambda Inspect is now installed. Happy coding! 🚀"
