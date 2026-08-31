import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const siteDir = join(root, "dist", "github-pages");
const clientDir = join(root, "dist", "client");
const prerenderedDir = join(root, "dist", "server", "prerendered-routes");
const defaultBasePath = "/Threebyrd";
const customDomain = process.env.GITHUB_PAGES_CUSTOM_DOMAIN?.replace(/\/$/, "");
const basePath = customDomain
  ? ""
  : process.env.GITHUB_PAGES_BASE_PATH ?? defaultBasePath;
const siteUrl = customDomain
  ?? process.env.NEXT_PUBLIC_SITE_URL
  ?? `https://thor-bw.github.io${basePath}`;

process.env.GITHUB_PAGES = "true";
process.env.GITHUB_PAGES_BASE_PATH = basePath;
process.env.NEXT_PUBLIC_BASE_PATH = basePath;
process.env.NEXT_PUBLIC_SITE_URL = siteUrl;
process.env.WRANGLER_LOG_PATH ??= ".wrangler/wrangler.log";

await run("vinext", ["build", "--prerender-all"]);

if (!existsSync(clientDir)) {
  throw new Error("Expected dist/client to exist after vinext build.");
}
if (!existsSync(prerenderedDir)) {
  throw new Error("Expected dist/server/prerendered-routes to exist after prerender.");
}

await rm(siteDir, { recursive: true, force: true });
await mkdir(siteDir, { recursive: true });
await cp(clientDir, siteDir, { recursive: true });
await cp(prerenderedDir, siteDir, { recursive: true });
await createPrettyRouteIndexes(siteDir);
await prefixStaticReferences(siteDir, basePath);
await writeFile(join(siteDir, ".nojekyll"), "");
await validateCustomDomainArtifact(siteDir, customDomain, defaultBasePath);

console.log(`Prepared GitHub Pages artifact at ${relative(root, siteDir)}/`);

async function createPrettyRouteIndexes(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await createPrettyRouteIndexes(entryPath);
      continue;
    }
    if (!entry.name.endsWith(".html") || entry.name === "index.html" || entry.name === "404.html") {
      continue;
    }

    const routeName = entry.name.slice(0, -".html".length);
    const routeDirectory = join(directory, routeName);
    await mkdir(routeDirectory, { recursive: true });
    await cp(entryPath, join(routeDirectory, "index.html"));
  }
}

async function validateCustomDomainArtifact(directory, domain, forbiddenPrefix) {
  if (!domain) return;

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await validateCustomDomainArtifact(entryPath, domain, forbiddenPrefix);
      continue;
    }
    if (!shouldRewrite(entry.name)) continue;

    const contents = await readFile(entryPath, "utf8");
    if (contents.includes(`${forbiddenPrefix}/`)) {
      throw new Error(
        `Custom-domain artifact contains repository-prefixed URL ${forbiddenPrefix}/ in ${relative(root, entryPath)}.`,
      );
    }
  }
}

async function prefixStaticReferences(directory, prefix) {
  if (!prefix) return;

  const viteRelativePrefix = prefix.replace(/^\//, "");

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await prefixStaticReferences(entryPath, prefix);
      continue;
    }
    if (!shouldRewrite(entry.name)) continue;

    const current = await readFile(entryPath, "utf8");
    const next = current
      .replaceAll('"/_next/', `"${prefix}/_next/`)
      .replaceAll("'/_next/", `'${prefix}/_next/`)
      .replaceAll("`/_next/", `\`${prefix}/_next/`)
      .replaceAll('"_next/', `"${viteRelativePrefix}/_next/`)
      .replaceAll("'_next/", `'${viteRelativePrefix}/_next/`)
      .replaceAll("`_next/", `\`${viteRelativePrefix}/_next/`)
      .replaceAll("(/_next/", `(${prefix}/_next/`)
      .replaceAll('"/assets/', `"${prefix}/assets/`)
      .replaceAll("'/assets/", `'${prefix}/assets/`)
      .replaceAll("`/assets/", `\`${prefix}/assets/`)
      .replaceAll("(/assets/", `(${prefix}/assets/`)
      .replaceAll('"/favicon.svg', `"${prefix}/favicon.svg`)
      .replaceAll("'/favicon.svg", `'${prefix}/favicon.svg`)
      .replaceAll('"/og.png', `"${prefix}/og.png`)
      .replaceAll("'/og.png", `'${prefix}/og.png`);

    if (next !== current) {
      await writeFile(entryPath, next);
    }
  }
}

function shouldRewrite(fileName) {
  return new Set([".css", ".html", ".js", ".json", ".rsc"]).has(extname(fileName));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}
