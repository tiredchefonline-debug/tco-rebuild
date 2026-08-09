import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
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
const htmlFiles = files.filter((file) => extname(file).toLowerCase() === ".html");

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
}

JSON.parse(await readFile(join(root, "manifest.webmanifest"), "utf8"));

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Site check passed: ${htmlFiles.length} HTML pages and all local references are valid.`);
}
