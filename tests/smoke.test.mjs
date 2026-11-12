import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");

test("index.html contient les éléments principaux", () => {
  for (const id of ["board", "taskText", "taskPrio", "search"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("les fonctions principales sont présentes", () => {
  for (const name of ["addTask", "render", "save", "exportBackup", "importBackup"]) {
    assert.match(html, new RegExp(`function ${name}\\s*\\(`));
  }
});
