import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = process.cwd();

const completedSchedule = {
  generatedAt: "2026-07-25T00:00:00.000Z",
  includedMatches: 2,
  totalMatchesInTournament: 2,
  completedMatches: 2,
  sources: [],
  standings: [],
  scorers: [],
  matches: [
    {
      id: "m001",
      matchNumber: 1,
      stage: "group",
      stageName: "小组赛",
      group: "A",
      dateTime: "2026-06-12T03:00:00+08:00",
      home: "墨西哥",
      away: "南非",
      venue: "Mexico City Stadium",
      city: "墨西哥城",
      sourceStatus: "verified",
      matchStatus: { key: "played", zh: "已结束" },
      score: { home: 2, away: 0 }
    },
    {
      id: "m002",
      matchNumber: 2,
      stage: "final",
      stageName: "决赛",
      group: "",
      dateTime: "2026-07-20T03:00:00+08:00",
      home: "西班牙",
      away: "阿根廷",
      venue: "New York/New Jersey Stadium",
      city: "纽约/新泽西",
      sourceStatus: "verified",
      matchStatus: { key: "played", zh: "已结束" },
      score: { home: 1, away: 0 }
    }
  ]
};

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

test("completed tournament shows an ended state instead of the first match", { timeout: 30_000 }, async (t) => {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/schedule.json") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(completedSchedule));
      return;
    }

    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    try {
      const body = await readFile(path.join(root, relativePath));
      response.writeHead(200, { "Content-Type": contentTypes[path.extname(relativePath)] || "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const address = server.address();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: "networkidle" });

  const summary = await page.evaluate(() => ({
    teams: document.querySelector("#nextTeams")?.textContent.trim(),
    time: document.querySelector("#nextTime")?.textContent.trim(),
    venue: document.querySelector("#nextVenue")?.textContent.trim()
  }));

  assert.deepEqual(summary, {
    teams: "赛事已结束",
    time: "暂无下一场比赛",
    venue: ""
  });
});
