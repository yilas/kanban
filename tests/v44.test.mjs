import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, "Inline script missing");

function setup(initial) {
  const store = new Map(initial ? [["kanban_universal_db", JSON.stringify(initial)]] : []);
  const elements = [];
  const createElement = (tag) => {
    const node = {
      tag,
      children: [],
      classList: { add() {}, remove() {}, toggle() {} },
      style: {},
      addEventListener() {},
      setAttribute() {},
      appendChild(child) { this.children.push(child); return child; },
      replaceChildren(...children) { this.children = children; },
      click() {},
      set textContent(value) { this.text = value; },
      get textContent() { return this.text; },
    };
    elements.push(node);
    return node;
  };
  const board = createElement("board");
  const inputs = {
    board,
    search: { value: "" },
    taskText: { value: "", addEventListener() {} },
    taskPrio: { value: "2" },
    newColTitle: { value: "" },
    priorityFilter: { value: "all" },
  };
  const context = {
    document: {
      body: { dataset: {} },
      addEventListener() {},
      getElementById(id) { return inputs[id]; },
      createElement,
      querySelector() { return null; },
    },
    window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    localStorage: {
      getItem(key) { return store.get(key) ?? null; },
      setItem(key, value) { store.set(key, value); },
    },
    crypto: { randomUUID: (() => { let n = 0; return () => "uuid-" + ++n; })() },
    confirm: () => true,
    alert: () => {},
    console,
    URL,
    Blob,
    setTimeout,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, store, elements, inputs };
}

const legacy = {
  columns: ["BACKLOG", "EN COURS", "TERMINÉ"],
  tasks: [{ id: 123456, text: "- [ ] Old task", prio: 2, status: "BACKLOG", completed: false }],
  settings: { theme: "dark" },
};

test("legacy numeric IDs and checklists are preserved on load", () => {
  const { store } = setup(legacy);
  assert.deepEqual(JSON.parse(store.get("kanban_universal_db")), legacy);
});

test("new and duplicated tasks receive distinct UUIDs", () => {
  const { context, inputs, store } = setup(legacy);
  inputs.taskText.value = "New task";
  vm.runInContext("addTask(); duplicateTask(data.tasks[1].id);", context);
  const ids = JSON.parse(store.get("kanban_universal_db")).tasks.map((task) => String(task.id));
  assert.equal(new Set(ids).size, 3);
});

test("invalid JSON schema and unknown status are rejected", () => {
  const { context } = setup();
  for (const invalid of [
    { ...legacy, columns: [] },
    { ...legacy, columns: ["BACKLOG", "BACKLOG"] },
    { ...legacy, tasks: [{ ...legacy.tasks[0], status: "MISSING" }] },
    { ...legacy, tasks: [{ ...legacy.tasks[0], prio: 4 }] },
    { ...legacy, tasks: [legacy.tasks[0], legacy.tasks[0]] },
  ]) {
    context.candidate = invalid;
    assert.throws(() => vm.runInContext("validateData(candidate)", context));
  }
});

test("a sole column cannot be removed", () => {
  const { context, store } = setup({ ...legacy, columns: ["BACKLOG"] });
  vm.runInContext('removeColumn("BACKLOG")', context);
  assert.equal(JSON.parse(store.get("kanban_universal_db")).columns.length, 1);
});

test("HTML in task text and column names is displayed as text", () => {
  const payload = '<img src=x onerror=alert(1)>';
  const { elements } = setup({
    columns: [payload],
    tasks: [{ id: 1, text: payload, prio: 1, status: payload, completed: false }],
    settings: { theme: "dark" },
  });
  assert.ok(elements.some((node) => node.text === payload));
  assert.ok(elements.every((node) => !Object.hasOwn(node, "innerHTML")));
});

test("invalid drop target leaves task unchanged", () => {
  const { context, store } = setup(legacy);
  const before = store.get("kanban_universal_db");
  context.dropEvent = {
    preventDefault() {},
    currentTarget: { classList: { remove() {} } },
    dataTransfer: { getData: () => "123456" },
  };
  vm.runInContext('onDrop(dropEvent, "UNKNOWN", 1, true)', context);
  assert.equal(store.get("kanban_universal_db"), before);
});
