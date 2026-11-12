import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const html = readFileSync("index.html", "utf8");
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];

if (scripts.length === 0) {
  throw new Error("Aucun script trouvé dans index.html");
}

const dir = mkdtempSync(join(tmpdir(), "kanban-check-"));

try {
  for (const [index, match] of scripts.entries()) {
    const file = join(dir, `script-${index}.js`);
    writeFileSync(file, match[1]);
    execFileSync(process.execPath, ["--check", file], {
      stdio: "inherit",
    });
  }

  console.log("JavaScript syntax OK");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
