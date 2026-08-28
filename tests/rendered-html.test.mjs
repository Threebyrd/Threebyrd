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
  assert.doesNotMatch(html, /data-testid="meal-scene"/);
  assert.match(html, /Threebyrd Meal Prep/);
  assert.match(html, /Online ordering opens soon/);
  assert.match(html, /Chicken or beef\. Little or Big\./);
  assert.match(html, /Sizes/);
  assert.match(html, /Small \+ Big/);
  assert.match(html, /Weekly plans/);
  assert.match(html, /3–20 meals/);
  for (const value of ["660", "46.5g", "77.5g", "17g", "970", "69g", "114g", "26g", "960", "66.5g", "41g"]) {
    assert.match(html, new RegExp(value.replace(".", "\\.")));
  }
  for (const plan of [3, 5, 10, 20]) {
    assert.match(html, new RegExp(`<strong>${plan}</strong><span>Meals / week`));
  }

  for (const product of ["Little Chicken", "Big Chicken", "Little Beef", "Big Beef"]) {
    assert.match(html, new RegExp(product));
  }

  for (const sectionCopy of [
    "Pick your weekly rhythm.",
    "Four boxes.",
    "Two choices.",
    "Protein, rice, broccoli.",
    "Meals made for Ithaca.",
    "From SBX Chicken",
    "Three founders.",
    "Be first at the table.",
  ]) {
    assert.match(html, new RegExp(sectionCopy.replace(".", "\\.")));
  }

  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /Verified Beef macro set/);
  assert.doesNotMatch(html, /MOST POPULAR|BEST VALUE|Order now|Shop now/i);

  assert.equal((html.match(/class="menuCard /g) ?? []).length, 4);
  assert.equal((html.match(/class="cardNutrition"/g) ?? []).length, 4);
  assert.equal((html.match(/class="cardIngredients"/g) ?? []).length, 4);
});

test("keeps the hero free of a 3D chicken scene and interactive selectors accessible", async () => {
  const [page, css, packageJson, plans, ingredients, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/components/WeeklyPlans.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/IngredientStory.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /MealScene|heroCubeLabel|low-poly chicken/i);
  assert.match(css, /\.menuGrid\s*\{/);
  assert.match(css, /grid-template-columns:\s*repeat\(4/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /--tb-paper:/);
  for (const color of ["#fef9d9", "#282828", "#ff5332", "#ffc232", "#ffcf5c", "#ffba92", "#ffe5a6"]) {
    assert.match(css, new RegExp(color));
  }
  assert.match(css, /font-family:\s*var\(--font-display\)/);
  assert.match(css, /Major headings use the same outlined, hard-offset construction/);
  assert.match(css, /box-shadow:\s*7px 7px 0 var\(--tb-line\)/);
  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(packageJson, /"three"/);
  assert.match(plans, /useState/);
  assert.match(plans, /aria-pressed/);
  assert.match(ingredients, /useState/);
  assert.match(ingredients, /aria-pressed/);
  assert.match(layout, /@fontsource\/anton/);
  assert.match(layout, /@fontsource-variable\/inter/);
  assert.doesNotMatch(page, /&nearr;/);
  assert.doesNotMatch(page, /chili powder|paprika|cumin|oregano|onion flakes/i);
});
