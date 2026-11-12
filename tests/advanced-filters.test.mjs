import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source);

function setup() {
  const begin = source.indexOf("const ADVANCED_FILTER_KEY");
  const end = source.indexOf("const LABEL_LIMIT", begin);
  assert.ok(begin >= 0 && end > begin);
  const context = {
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    todayLocal: () => "2026-11-12",
    data: {
      tasks: [
        { text: "Alpha", prio: 2, labels: ["DevOps"], completed: false, dueDate: "2026-11-10" },
        { text: "Bravo", prio: 1, labels: ["Personal"], completed: true },
        { text: "Charlie", prio: 3, completed: false, dueDate: "2026-11-20" },
      ],
    },
    priorityFilter: "all",
  };
  vm.createContext(context);
  vm.runInContext(source.slice(begin, end), context);
  return context;
}

test("legacy tasks without labels are included in unfiltered results", () => {
  const ctx = setup();
  assert.equal(vm.runInContext('filteredTasks("").length', ctx), 3);
});

test("label and status filters combine", () => {
  const ctx = setup();
  vm.runInContext('advancedFilters.label = "DevOps"; advancedFilters.status = "active"', ctx);
  assert.deepEqual(Array.from(vm.runInContext('filteredTasks("").map(t => t.text)', ctx)), ["Alpha"]);
});

test("due-date filters exclude completed tasks from overdue results", () => {
  const ctx = setup();
  vm.runInContext('advancedFilters.due = "overdue"', ctx);
  assert.deepEqual(Array.from(vm.runInContext('filteredTasks("").map(t => t.text)', ctx)), ["Alpha"]);
});

test("sorting does not mutate stored task order", () => {
  const ctx = setup();
  vm.runInContext('advancedFilters.sort = "priority"', ctx);
  assert.deepEqual(Array.from(vm.runInContext('filteredTasks("").map(t => t.text)', ctx)), ["Bravo", "Alpha", "Charlie"]);
  assert.deepEqual(Array.from(ctx.data.tasks.map(t => t.text)), ["Alpha", "Bravo", "Charlie"]);
});
