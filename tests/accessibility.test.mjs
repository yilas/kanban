import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);

function boot() {
  const initial = {
    tasks: [{ id: 12, text: "Keep data", prio: 2, status: "BACKLOG", completed: true }],
    columns: ["BACKLOG", "EN COURS"],
    settings: { theme: "dark" },
  };
  const store = new Map([["kanban_universal_db", JSON.stringify(initial)]]);
  const elements = new Map();
  const createElement = (tag) => ({
    tagName: tag.toUpperCase(),
    value: "",
    children: [], style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    addEventListener() {}, setAttribute() {},
    showModal() { this.open = true; }, close() { this.open = false; },
    set textContent(v) { this.text = v; }, get textContent() { return this.text; },
  });
  const document = {
    body: { dataset: {} }, createElement, addEventListener() {},
    querySelector() { return null; },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement(id));
      return elements.get(id);
    },
  };
  const context = {
    document, window: { addEventListener() {}, matchMedia: () => ({ matches: true, addEventListener() {} }) },
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    crypto: { randomUUID: () => "uuid-1" },
    alert() {}, confirm: () => true, console, Date, URL, Blob, setTimeout,
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return { context, store, document, elements, initial };
}

test("help and settings dialogs can open and close", () => {
  const { context, elements } = boot();
  vm.runInContext("openHelp(); openSettings()", context);
  assert.equal(elements.get("helpDialog").open, true);
  assert.equal(elements.get("settingsDialog").open, true);
  vm.runInContext('closeDialog("helpDialog")', context);
  assert.equal(elements.get("helpDialog").open, false);
});

test("system theme follows dark preference without changing task data", () => {
  const { document, store, initial } = boot();
  assert.equal(document.body.dataset.theme, "dark");
  assert.deepEqual(JSON.parse(store.get("kanban_universal_db")), initial);
});

test("explicit light preference persists without rewriting tasks", () => {
  const { context, store, document, initial } = boot();
  vm.runInContext('setThemePreference("light")', context);
  assert.equal(document.body.dataset.theme, "light");
  assert.equal(store.get("kanban_theme_preference_v50"), "light");
  assert.deepEqual(JSON.parse(store.get("kanban_universal_db")), initial);
});

test("invalid theme preferences are ignored", () => {
  const { context, store } = boot();
  vm.runInContext('setThemePreference("unknown")', context);
  assert.equal(store.has("kanban_theme_preference_v50"), false);
});

test("keyboard/touch movement preserves task priority and completion", () => {
  const { context, store } = boot();
  vm.runInContext("moveTask(12, 1)", context);
  const task = JSON.parse(store.get("kanban_universal_db")).tasks[0];
  assert.equal(task.status, "EN COURS");
  assert.equal(task.prio, 2);
  assert.equal(task.completed, true);
});

test("out-of-range movement does not modify stored data", () => {
  const { context, store } = boot();
  const before = store.get("kanban_universal_db");
  vm.runInContext("moveTask(12, -1)", context);
  assert.equal(store.get("kanban_universal_db"), before);
});
