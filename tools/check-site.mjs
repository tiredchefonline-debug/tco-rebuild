import { access, readFile, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

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

  for (const form of html.matchAll(/<form\b[^>]*>/gi)) {
    const openingTag = form[0];
    const toolName = openingTag.match(/\btoolname\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
    const toolDescription = openingTag.match(/\btooldescription\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
    if (!toolName || !toolDescription) issues.push(`${relativePage}: form is missing complete WebMCP annotations`);
  }

  for (const asset of ["css/site.css", "js/site.js", "js/webmcp.js"]) {
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

const contactHtml = await readFile(join(root, "contact.html"), "utf8");
const websiteField = contactHtml.match(/<input\b[^>]*\bname\s*=\s*["']website["'][^>]*>/i)?.[0];

if (!websiteField) {
  issues.push("contact.html: missing website or online profile field");
} else {
  if (/\btype\s*=\s*["']url["']/i.test(websiteField)) {
    issues.push("contact.html: website field must accept entries without an http(s) protocol");
  }
  if (!/\baria-describedby\s*=\s*["']website-help["']/i.test(websiteField)) {
    issues.push("contact.html: website field must explain its flexible input format");
  }
}

if (!/\bid\s*=\s*["']website-help["']/i.test(contactHtml) || !/no https:\/\/ needed/i.test(contactHtml)) {
  issues.push("contact.html: missing website input guidance");
}

JSON.parse(await readFile(join(root, "manifest.webmanifest"), "utf8"));

const llmsText = await readFile(join(root, "llms.txt"), "utf8");
const llmsH1s = countMatches(llmsText, /^#\s+\S.*$/gm);
if (llmsText.length < 50) issues.push("llms.txt: expected at least 50 characters");
if (llmsH1s !== 1) issues.push(`llms.txt: expected exactly one H1, found ${llmsH1s}`);
if (!/^>\s+\S.*$/m.test(llmsText)) issues.push("llms.txt: missing blockquote summary");
if (!/^##\s+\S.*$/m.test(llmsText)) issues.push("llms.txt: missing linked H2 section");
if (!/\[[^\]]+\]\(https:\/\/tiredchefonline\.com\/[^)]*\)/.test(llmsText)) {
  issues.push("llms.txt: missing canonical Markdown link");
}

const webMcpSource = await readFile(join(root, "assets", "js", "webmcp.js"), "utf8");
const registeredTools = [];

try {
  runInNewContext(webMcpSource, {
    document: {
      modelContext: {
        registerTool(tool) {
          registeredTools.push(tool);
          return Promise.resolve();
        }
      }
    },
    Promise
  });
} catch (error) {
  issues.push(`assets/js/webmcp.js: registration script failed (${error.message})`);
}

if (!registeredTools.length) issues.push("assets/js/webmcp.js: expected at least one registered tool");

const toolNames = new Set();
for (const tool of registeredTools) {
  if (typeof tool.name !== "string" || !/^[A-Za-z0-9_.-]{1,128}$/.test(tool.name)) {
    issues.push("assets/js/webmcp.js: tool has an invalid name");
  } else if (toolNames.has(tool.name)) {
    issues.push(`assets/js/webmcp.js: duplicate tool name ${tool.name}`);
  } else {
    toolNames.add(tool.name);
  }

  if (typeof tool.description !== "string" || !tool.description.trim()) {
    issues.push(`assets/js/webmcp.js: ${tool.name || "unnamed tool"} is missing a description`);
  }

  const schema = tool.inputSchema;
  if (!schema || schema.type !== "object" || !schema.properties || typeof schema.properties !== "object") {
    issues.push(`assets/js/webmcp.js: ${tool.name || "unnamed tool"} has an invalid object schema`);
    continue;
  }

  for (const requiredName of schema.required || []) {
    if (!(requiredName in schema.properties)) {
      issues.push(`assets/js/webmcp.js: ${tool.name} requires unknown property ${requiredName}`);
    }
  }

  for (const [propertyName, property] of Object.entries(schema.properties)) {
    if (!property || typeof property !== "object" || typeof property.type !== "string") {
      issues.push(`assets/js/webmcp.js: ${tool.name}.${propertyName} has an invalid schema`);
    }
    if (property.enum && (!Array.isArray(property.enum) || !property.enum.length)) {
      issues.push(`assets/js/webmcp.js: ${tool.name}.${propertyName} has an invalid enum`);
    }
    if (typeof property.description !== "string" || !property.description.trim()) {
      issues.push(`assets/js/webmcp.js: ${tool.name}.${propertyName} is missing a description`);
    }
  }

  if (typeof tool.execute !== "function") issues.push(`assets/js/webmcp.js: ${tool.name} is missing execute()`);
}

const netlifyConfig = await readFile(join(root, "netlify.toml"), "utf8");
const headerBlocks = netlifyConfig.split("[[headers]]");
const globalHeaderBlock = headerBlocks.find((candidate) => candidate.includes('for = "/*"'));
const llmsHeaderBlock = headerBlocks.find((candidate) => candidate.includes('for = "/llms.txt"'));

if (!globalHeaderBlock || !/Permissions-Policy\s*=\s*"[^"]*tools=\(self\)/i.test(globalHeaderBlock)) {
  issues.push("netlify.toml: WebMCP tools must be allowed for the same origin");
}

if (!llmsHeaderBlock || !/Content-Type\s*=\s*"text\/plain;\s*charset=UTF-8"/i.test(llmsHeaderBlock)) {
  issues.push("netlify.toml: /llms.txt must be served as UTF-8 plain text");
}

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
  console.log(`Site check passed: ${htmlFiles.length} HTML pages, ${googleVerificationFiles.length} Google verification file, and agent discovery metadata are valid.`);
}
