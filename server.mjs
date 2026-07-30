import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const buildRoot = path.join(root, "dist");
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://local").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const sourceTarget = path.resolve(root, relative);
    if (!sourceTarget.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const buildTarget = path.resolve(buildRoot, relative);
    let file = sourceTarget;
    try {
      const buildMetadata = await stat(buildTarget);
      file = buildMetadata.isDirectory()
        ? path.join(buildTarget, "index.html")
        : buildTarget;
    } catch {
      const sourceMetadata = await stat(sourceTarget);
      file = sourceMetadata.isDirectory()
        ? path.join(sourceTarget, "index.html")
        : sourceTarget;
    }
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`GW2 Combat Simulator: http://127.0.0.1:${port}`);
});
