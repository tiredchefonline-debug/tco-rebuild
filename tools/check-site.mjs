import { access, readFile, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const issues = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }

  return files;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function countMatches(source, expression) {
  return Array.from(source.matchAll(expression)).length;
}

function resolveLocalReference(page, reference) {
  const [withQuery, fragment = ""] = reference.split("#", 2);
  const path = withQuery.split("?", 1)[0];
  let target;

  if (!path) target = page;
  else if (path === "/") target = join(root, "index.html");
  else if (path.startsWith("/")) target = join(root, path.slice(1));
  else target = resolve(dirname(page), path);

  if (path && path !== "/" && path.endsWith("/")) target = join(target, "index.html");
  return { fragment, target };
}

const files = await walk(root);
const googleVerificationFiles = files.filter((file) => /^google[a-z0-9]+\.html$/i.test(basename(file)));
const htmlFiles = files.filter((file) => extname(file).toLowerCase() === ".html" && !googleVerificationFiles.includes(file));

for (const page of htmlFiles) {
  const html = await readFile(page, "utf8");
  const relativePage = page.slice(root.length + 1);

  for (const tag of ["title", "h1", "main"]) {
    const count = countMatches(html, new RegExp(`<${tag}(?:\\s|>)`, "gi"));
    if (count !== 1) issues.push(`${relativePage}: expected one <${tag}>, found ${count}`);
  }

  const ids = Array.from(html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi), (match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  for (const id of new Set(duplicateIds)) issues.push(`${relativePage}: duplicate id "${id}"`);

  for (const match of html.matchAll(/<(?:a|link|script|img|iframe|form)\b[^>]*?\b(?:href|src|action)\s*=\s*["']([^"']+)["']/gi)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(reference)) continue;
    const { fragment, target } = resolveLocalReference(page, reference);

    if (!(target === root || target.startsWith(root + sep))) {
      issues.push(`${relativePage}: reference escapes site root (${reference})`);
      continue;
    }

    if (!(await exists(target))) {
      issues.push(`${relativePage}: missing local reference ${reference}`);
      continue;
    }

    if (fragment && extname(target).toLowerCase() === ".html") {
      const targetHtml = await readFile(target, "utf8");
      const fragmentPattern = new RegExp(`\\bid\\s*=\\s*["']${fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i");
      if (!fragmentPattern.test(targetHtml)) issues.push(`${relativePage}: missing fragment ${reference}`);
    }
  }

  for (const image of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\balt\s*=/i.test(image[0])) issues.push(`${relativePage}: image is missing alt text`);
  }

  for (const asset of ["css/site.css", "js/site.js"]) {
    const escapedAsset = asset.replace(".", "\\.");
    const versionedAsset = new RegExp(`/assets/${escapedAsset}\\?v=[^\"'\\s>]+`, "i");
    if (!versionedAsset.test(html)) issues.push(`${relativePage}: missing versioned reference for /assets/${asset}`);
  }
}

for (const file of googleVerificationFiles) {
  const expected = `google-site-verification: ${basename(file)}`;
  const actual = (await readFile(file, "utf8")).trim();
  if (actual !== expected) issues.push(`${basename(file)}: invalid Google site verification token`);
}

JSON.parse(await readFile(join(root, "manifest.webmanifest"), "utf8"));

const netlifyConfig = await readFile(join(root, "netlify.toml"), "utf8");
const headerBlocks = netlifyConfig.split("[[headers]]");

for (const assetPath of ["/assets/css/*", "/assets/js/*"]) {
  const block = headerBlocks.find((candidate) => candidate.includes(`for = "${assetPath}"`));
  if (!block || !/Cache-Control\s*=\s*"[^"]*max-age=0(?:,|")/i.test(block)) {
    issues.push(`netlify.toml: ${assetPath} must revalidate with max-age=0`);
  }
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Site check passed: ${htmlFiles.length} HTML pages, ${googleVerificationFiles.length} Google verification file, and all local references are valid.`);
}
