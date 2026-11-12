import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source);

test("archivedAt remains optional for legacy tasks", () => {
  const start = source.indexOf("function validArchivedAt(value)");
  const end = source.indexOf("function archiveTask(id)", start);
  assert.ok(start >= 0 && end > start);
  const context = { Date };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  assert.equal(context.validArchivedAt(undefined), true);
  assert.equal(context.validArchivedAt("2026-11-12T15:00:00.000Z"), true);
  assert.equal(context.validArchivedAt("not a date"), false);
});

test("archive is validated in task schema", () => {
  assert.match(source, /!validArchivedAt\(task\.archivedAt\)/);
});

test("archive and restore use saveState, preserving undo and export", () => {
  assert.match(source, /function archiveTask\(id\)[\s\S]*?saveState\(next\)/);
  assert.match(source, /function restoreArchivedTask\(id\)[\s\S]*?delete next\.tasks[\s\S]*?saveState\(next\)/);
});

test("archived tasks are excluded from active filters", () => {
  assert.match(source, /if \(task\.archivedAt\) return false/);
});
