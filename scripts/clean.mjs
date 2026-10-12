#!/usr/bin/env node
// Removes build outputs and caches across the monorepo (cross-platform).
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const targets = ["dist", "coverage", ".turbo", "playwright-report", "test-results"];
const roots = ["apps", "packages"];

const remove = (path) => rmSync(path, { recursive: true, force: true });

remove(".turbo");
for (const root of roots) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const target of targets) remove(join(root, entry.name, target));
  }
}
console.log("clean: done");
