import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the complete Threebyrd landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Threebyrd Meal Prep - Chicken and Beef Meal Prep<\/title>/i);
  assert.match(html, /data-testid="meal-scene"/);
  assert.match(html, /Threebyrd Meal Prep/);
  assert.match(html, /Chicken or beef\. Little or Big\./);
  assert.match(html, /Chicken protein/);
  assert.match(html, /~60-70g/);

  for (const product of ["Little Chicken", "Big Chicken", "Little Beef", "Big Beef"]) {
    assert.match(html, new RegExp(product));
  }

  assert.equal((html.match(/class="menuCard /g) ?? []).length, 4);
  assert.equal((html.match(/class="cardNutrition"/g) ?? []).length, 4);
  assert.equal((html.match(/class="cardIngredients"/g) ?? []).length, 4);
});

test("keeps the interactive scene isolated and motion-aware", async () => {
  const [scene, page, css, packageJson] = await Promise.all([
    readFile(new URL("../app/components/MealScene.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(scene, /^"use client";/);
  assert.match(scene, /from "three"/);
  assert.match(scene, /RoundedBoxGeometry/);
  assert.match(scene, /hero-chicken-texture\.jpg/);
  assert.match(scene, /MeshPhysicalMaterial/);
  assert.match(scene, /pointerdown/);
  assert.match(scene, /prefers-reduced-motion/);
  assert.match(scene, /data-testid="meal-scene"/);
  assert.match(scene, /dataset\.pixelCheck/);
  assert.match(page, /<MealScene \/>/);
  assert.match(css, /\.menuGrid\s*\{/);
  assert.match(css, /grid-template-columns:\s*repeat\(4/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(packageJson, /"three"/);
  assert.doesNotMatch(page, /&nearr;/);
  assert.doesNotMatch(`${page}\n${scene}`, /chili powder|paprika|cumin|oregano|onion flakes/i);
});
