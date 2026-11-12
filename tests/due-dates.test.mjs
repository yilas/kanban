import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);

function dateFunctions() {
  const from = script.indexOf("function validDueDate(value)");
  const to = script.indexOf("const THEME_PREFERENCE_KEY", from);
  assert.ok(from >= 0 && to > from);
  const functions = script.slice(from, to);
  const context = { Date };
  vm.createContext(context);
  vm.runInContext(functions, context);
  return context;
}

test("legacy tasks without dueDate remain supported", () => {
  const { validDueDate } = dateFunctions();
  assert.equal(validDueDate(undefined), true);
  assert.equal(validDueDate(null), true);
  assert.equal(validDueDate(""), true);
});

test("dates must be real ISO calendar dates", () => {
  const { validDueDate } = dateFunctions();
  assert.equal(validDueDate("2026-11-12"), true);
  assert.equal(validDueDate("2024-02-29"), true);
  for (const value of ["2026-02-29", "2026-13-01", "2026-00-01", "2026-11-31", "12/11/2026", "<script>"]) {
    assert.equal(validDueDate(value), false, value);
  }
});

test("due date is a separate optional task field, not embedded in text", () => {
  assert.match(script, /next\.tasks\.push\(\{ id: newTaskId\(\), text, prio, status:/);
  assert.match(script, /dueDate \? \{ dueDate \} : \{\}/);
  assert.match(script, /delete updated\.dueDate/);
});

test("overdue markers exclude completed tasks", () => {
  const { dueStatus } = dateFunctions();
  assert.equal(dueStatus({ dueDate: "2000-01-01", completed: true }), "");
  assert.equal(dueStatus({ dueDate: "2000-01-01", completed: false }), "overdue");
  assert.equal(dueStatus({ completed: false }), "");
});
