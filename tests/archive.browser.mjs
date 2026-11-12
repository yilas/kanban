import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const data = {
      columns: ["BACKLOG", "EN COURS"],
      settings: { theme: "dark" },
      tasks: [{ id: "archive-fixture", text: "Archived fixture", prio: 2, status: "BACKLOG", completed: true }],
    };
    localStorage.setItem("kanban_universal_db", JSON.stringify(data));
  });
  await page.reload();
  const card = page.locator(".card").filter({ hasText: "Archived fixture" });
  await card.locator('button[title="Archiver la tâche terminée"]').click();
  assert.equal(await page.locator(".card").filter({ hasText: "Archived fixture" }).count(), 0);
  const archived = await page.evaluate(() => JSON.parse(localStorage.getItem("kanban_universal_db")).tasks[0]);
  assert.ok(archived.archivedAt);
  await page.reload();
  await page.getByRole("button", { name: /Archives/ }).click();
  const dialog = page.locator("#archiveDialog");
  await dialog.getByText("Archived fixture").waitFor();
  await dialog.locator('button[title="Restaurer la tâche"]').click();
  await dialog.getByRole("button", { name: "Fermer" }).click();
  await page.locator(".card").filter({ hasText: "Archived fixture" }).waitFor();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("kanban_universal_db")).tasks[0]);
  assert.equal(restored.archivedAt, undefined);
  assert.deepEqual(errors, []);
  console.log("Archive browser regression passed");
} finally {
  await browser.close();
}
