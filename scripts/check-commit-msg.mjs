#!/usr/bin/env node
// Validates that a commit message follows Conventional Commits.
// Usage: node scripts/check-commit-msg.mjs <path-to-commit-msg-file>
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("check-commit-msg: missing commit message file path");
  process.exit(1);
}

const header = readFileSync(file, "utf8").split("\n")[0].trim();

// Allow git-generated messages (merges, reverts, fixups).
if (/^(Merge|Revert|fixup!|squash!)/.test(header)) process.exit(0);

const pattern =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?!?: .{1,100}$/;

if (!pattern.test(header)) {
  console.error(`
✖ Invalid commit message: "${header}"

  Expected: <type>(<optional scope>): <description>
  Types:    feat fix docs style refactor perf test build ci chore revert
  Scopes:   web server shared engine bots infra deps docs
  Example:  feat(engine): add witch potions
`);
  process.exit(1);
}
