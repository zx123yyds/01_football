import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 5173);
const host = "127.0.0.1";
const refreshIntervalMs = Number(process.env.REFRESH_INTERVAL_MS || 5 * 60 * 1000);
let refreshInFlight = false;

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ics": "text/calendar; charset=utf-8"
};

const safePath = (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded === "/" ? "/index.html" : decoded);
  const fullPath = path.join(root, normalized);
  if (!fullPath.startsWith(root)) return null;
  return fullPath;
};

const publicPath = (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded);
  const fullPath = path.join(root, "public", normalized);
  if (!fullPath.startsWith(path.join(root, "public"))) return null;
  return fullPath;
};

const server = createServer(async (request, response) => {
  const directPath = safePath(request.url || "/");
  const fallbackPath = publicPath(request.url || "/");
  if (!directPath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    let filePath = directPath;
    let fileStat = await stat(filePath).catch(() => null);
    if (!fileStat && fallbackPath) {
      filePath = fallbackPath;
      fileStat = await stat(filePath).catch(() => null);
    }
    if (!fileStat) throw new Error("Not found");
    if (!fileStat.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream"
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

const runRefresh = (reason) => {
  if (refreshInFlight) {
    console.log(`Data refresh skipped (${reason}); previous refresh is still running.`);
    return;
  }

  refreshInFlight = true;
  const startedAt = new Date();
  console.log(`Refreshing data (${reason}) at ${startedAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
  const child = spawn("npm", ["run", "refresh"], {
    cwd: root,
    env: process.env,
    stdio: "inherit"
  });

  child.on("close", (code) => {
    refreshInFlight = false;
    const durationSeconds = Math.round((Date.now() - startedAt.getTime()) / 1000);
    if (code === 0) {
      console.log(`Data refresh completed in ${durationSeconds}s.`);
    } else {
      console.error(`Data refresh failed with exit code ${code}.`);
    }
  });
};

server.listen(port, host, () => {
  console.log(`Serving http://${host}:${port}`);
  console.log(`Auto-refreshing data every ${Math.round(refreshIntervalMs / 60000)} minutes.`);
  runRefresh("startup");
  setInterval(() => runRefresh("interval"), refreshIntervalMs).unref();
});
