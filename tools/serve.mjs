import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const port = Number.parseInt(process.env.PORT || "8765", 10);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

function safePath(pathname) {
  const requested = decodeURIComponent(pathname).replace(/^\/+/, "");
  const target = resolve(root, requested || "index.html");
  return target === root || target.startsWith(root + sep) ? target : null;
}

async function resolveFile(pathname) {
  let target = safePath(pathname);
  if (!target) return null;

  try {
    const info = await stat(target);
    if (info.isDirectory()) target = resolve(target, "index.html");
    await stat(target);
    return target;
  } catch {
    return null;
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  const target = await resolveFile(url.pathname);
  const file = target || resolve(root, "404.html");
  const status = target ? 200 : 404;

  response.writeHead(status, {
    "Content-Type": contentTypes[extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store"
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`TiredChefOnline preview: http://127.0.0.1:${port}/`);
});
