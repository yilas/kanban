import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
  await page.locator("#taskText").fill("Browser label regression");
  await page.locator("#taskLabels").fill("DevOps, Personnel");
  await page.getByRole("button", { name: /AJOUTER/i }).click();
  const card = page.locator(".card").filter({ hasText: "Browser label regression" });
  await card.waitFor();
  assert.equal(await card.locator(".task-label").count(), 2);
  assert.deepEqual(await card.locator(".task-label").allTextContents(), ["DevOps", "Personnel"]);
  await page.reload();
  const reloaded = page.locator(".card").filter({ hasText: "Browser label regression" });
  await reloaded.waitFor();
  assert.deepEqual(await reloaded.locator(".task-label").allTextContents(), ["DevOps", "Personnel"]);

  // Existing JSON schema and data are still readable after a reload.
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("kanban_universal_db")));
  assert.equal(persisted.tasks.length, 1);
  assert.deepEqual(persisted.tasks[0].labels, ["DevOps", "Personnel"]);

  await reloaded.locator('button[title="Modifier"]').click();
  await page.locator(".card.editing .edit-labels").fill("Infrastructure");
  await page.locator('.card.editing button[title="Sauver"]').click();
  assert.deepEqual(await page.locator(".card .task-label").allTextContents(), ["Infrastructure"]);
  // Filter the label, then confirm the task remains after a reload.
  await page.locator("#labelFilter").selectOption("Infrastructure");
  assert.equal(await page.locator(".card").count(), 1);
  await page.locator("#labelFilter").selectOption("DevOps").catch(() => {});
  await page.locator("#labelFilter").selectOption("all");
  await page.locator("#statusFilter").selectOption("done");
  assert.equal(await page.locator(".card").count(), 0);
  await page.locator("#statusFilter").selectOption("all");
  await page.locator("#sortFilter").selectOption("alpha");
  await page.reload();
  assert.equal(await page.locator("#sortFilter").inputValue(), "alpha");
  assert.deepEqual(errors, []);
  console.log("Browser test passed: create, display, reload and edit labels");
} finally {
  await browser.close();
}
