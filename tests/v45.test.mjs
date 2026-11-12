import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source);

function start(initial) {
  const db = new Map(initial ? [["kanban_universal_db", JSON.stringify(initial)]] : []);
  const nodes = {};
  const document = {
    body: { dataset: {} },
    getElementById(id) {
      return nodes[id] ||= { value: "", addEventListener() {}, replaceChildren() {}, appendChild() {} };
    },
    createElement() {
      return { children: [], style: {}, classList: { add() {}, remove() {} },
        appendChild(item) { this.children.push(item); }, addEventListener() {},
        set textContent(v) { this.text = v; }, get textContent() { return this.text; } };
    },
    querySelector() { return null; },
  };
  const context = {
    document, window: { addEventListener() {} },
    localStorage: { getItem: (k) => db.get(k) ?? null, setItem: (k, v) => db.set(k, v) },
    crypto: { randomUUID: () => "uuid-test" }, alert() {}, confirm: () => true,
    console, URL, Blob, setTimeout, Date,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, db, nodes };
}
const original = { tasks: [{ id: 123, text: "Old", prio: 2, status: "BACKLOG", completed: false }],
  columns: ["BACKLOG", "DONE"], settings: { theme: "dark" } };

test("legacy data stays unchanged on initial load", () => {
  const { db } = start(original);
  assert.deepEqual(JSON.parse(db.get("kanban_universal_db")), original);
});

test("deletion goes to persistent trash and undo restores it", () => {
  const { context, db } = start(original);
  vm.runInContext('removeTasks(["123"])', context);
  assert.equal(JSON.parse(db.get("kanban_universal_db")).tasks.length, 0);
  assert.equal(JSON.parse(db.get("kanban_universal_trash_v45")).length, 1);
  vm.runInContext("undoLast()", context);
  assert.equal(JSON.parse(db.get("kanban_universal_db")).tasks[0].id, 123);
});

test("trash can restore deleted tasks", () => {
  const { context, db } = start(original);
  vm.runInContext('removeTasks(["123"]); restoreLastDeleted()', context);
  assert.equal(JSON.parse(db.get("kanban_universal_db")).tasks.length, 1);
  assert.equal(JSON.parse(db.get("kanban_universal_trash_v45")).length, 0);
});

test("concurrent writes are refused without overwriting external data", () => {
  const { context, db } = start(original);
  const external = JSON.stringify({ ...original, tasks: [] });
  db.set("kanban_universal_db", external);
  assert.throws(() => vm.runInContext("toggleTheme()", context), /Conflit/);
  assert.equal(db.get("kanban_universal_db"), external);
});

test("snapshot keeps the previous valid state", () => {
  const { context, db } = start(original);
  vm.runInContext('removeTasks(["123"])', context);
  assert.equal(JSON.parse(db.get("kanban_universal_snapshot_v45")).data.tasks[0].id, 123);
});
