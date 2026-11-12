import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);

function boot(initialPreferences = {}) {
  const storage = new Map(Object.entries(initialPreferences));
  const elements = new Map();
  const createElement = (tag) => ({
    tag,
    children: [],
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    addEventListener() {},
    setAttribute(name, value) { this[name] = value; },
    set textContent(value) { this.text = value; },
    get textContent() { return this.text; },
  });
  const document = {
    body: { dataset: {} },
    createElement,
    querySelector() { return null; },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement(id));
      return elements.get(id);
    },
  };
  const context = {
    document,
    window: { addEventListener() {} },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    crypto: { randomUUID: () => "new-uuid" },
    alert() {},
    confirm: () => true,
    console,
    Date,
    URL,
    Blob,
    setTimeout,
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return { context, storage, elements };
}

const legacy = {
  tasks: [
    { id: 100, text: "Urgent", prio: 1, status: "BACKLOG", completed: false },
    { id: 101, text: "Later", prio: 3, status: "BACKLOG", completed: true },
  ],
  columns: ["BACKLOG", "EN COURS"],
  settings: { theme: "dark" },
};

test("detailed view is default and does not rewrite existing data", () => {
  const { storage, context } = boot({ kanban_universal_db: JSON.stringify(legacy) });
  assert.equal(vm.runInContext("boardView", context), "detailed");
  assert.equal(storage.get("kanban_universal_db"), JSON.stringify(legacy));
});

test("compact view preserves priorities, statuses and completion", () => {
  const { context, storage } = boot({ kanban_universal_db: JSON.stringify(legacy) });
  vm.runInContext('setBoardView("compact")', context);
  assert.equal(storage.get("kanban_view_v50"), "compact");
  assert.equal(storage.get("kanban_universal_db"), JSON.stringify(legacy));
});

test("priority filter combines with text search", () => {
  const { context, elements } = boot({ kanban_universal_db: JSON.stringify(legacy) });
  elements.get("search").value = "Urgent";
  vm.runInContext('setPriorityFilter("1")', context);
  const board = elements.get("board");
  const textNodes = [];
  function walk(node) {
    if (node.text) textNodes.push(node.text);
    for (const child of node.children || []) walk(child);
  }
  walk(board);
  assert.ok(textNodes.includes("Urgent"));
  assert.ok(!textNodes.includes("Later"));
});

test("invalid view and filter values are ignored", () => {
  const { context, storage } = boot();
  vm.runInContext('setBoardView("unknown"); setPriorityFilter("99")', context);
  assert.equal(vm.runInContext("boardView", context), "detailed");
  assert.equal(vm.runInContext("priorityFilter", context), "all");
  assert.equal(storage.has("kanban_view_v50"), false);
});

test("saved view and filter preferences are restored", () => {
  const { context } = boot({
    kanban_view_v50: "compact",
    kanban_priority_filter_v50: "2",
  });
  assert.equal(vm.runInContext("boardView", context), "compact");
  assert.equal(vm.runInContext("priorityFilter", context), "2");
});

test("compact drop changes only status", () => {
  const { context, storage } = boot({ kanban_universal_db: JSON.stringify(legacy) });
  context.dropEvent = {
    preventDefault() {},
    currentTarget: { classList: { remove() {} } },
    dataTransfer: { getData: () => "100" },
  };
  vm.runInContext('onCompactDrop(dropEvent, "EN COURS")', context);
  const task = JSON.parse(storage.get("kanban_universal_db")).tasks[0];
  assert.equal(task.status, "EN COURS");
  assert.equal(task.prio, 1);
  assert.equal(task.completed, false);
});
