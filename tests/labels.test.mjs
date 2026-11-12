import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source);

function labelHelpers() {
  const from = source.indexOf("const LABEL_LIMIT = 10;");
  const to = source.indexOf("function validDueDate(", from);
  assert.ok(from >= 0 && to > from);
  const context = {};
  vm.createContext(context);
  vm.runInContext(source.slice(from, to), context);
  return context;
}

test("legacy tasks without labels are valid", () => {
  const { validLabels } = labelHelpers();
  assert.equal(validLabels(undefined), true);
  assert.equal(validLabels([]), true);
});

test("parse labels trims whitespace and keeps order", () => {
  const { parseLabels } = labelHelpers();
  assert.deepEqual(Array.from(parseLabels(" DevOps, Personnel, ")), ["DevOps", "Personnel"]);
});

test("rejects duplicates and oversized labels", () => {
  const { parseLabels } = labelHelpers();
  assert.throws(() => parseLabels("DevOps, devops"));
  assert.throws(() => parseLabels("a".repeat(33)));
  assert.throws(() => parseLabels(Array.from({ length: 11 }, (_, i) => "L" + i).join(",")));
});

test("task schema validates optional labels and uses safe text rendering", () => {
  assert.match(source, /!validLabels\(task\.labels\)/);
  assert.match(source, /element\("span", "task-label", label\)/);
});
