import { access, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceStatusFile = path.join(root, "data", "source-status.json");

const targets = [
  {
    name: "CCTV standings",
    url: "https://cbs-u.sports.cctv.com/statistics/football/team/rankings?leagueId=3400&season=2026",
    file: path.join(root, "data", "cctv-rankings.json"),
    fallback: { results: [] },
    validate: (payload) => Array.isArray(payload?.results)
  },
  {
    name: "CCTV scorers",
    url: "https://cbs-u.sports.cctv.com/statistics/football/player/scorers?leagueId=3400&season=2026",
    file: path.join(root, "data", "cctv-scorers.json"),
    fallback: { results: [] },
    validate: (payload) => Array.isArray(payload?.results)
  },
  {
    name: "FIFA Watch live scores",
    url: "https://fifawatch.com/api/match-live.json?lang=zh",
    file: path.join(root, "data", "fifawatch-live.json"),
    fallback: [],
    validate: (payload) => Array.isArray(payload) || Number.isFinite(payload?.score?.a)
  },
  {
    name: "FIFA Watch schedule scores",
    url: "https://fifawatch.com/zh/schedule/",
    file: path.join(root, "data", "fifawatch-schedule.html"),
    fallback: "",
    type: "text",
    validate: (payload) => typeof payload === "string" && payload.includes("data-match-row") && payload.includes("data-score-display")
  }
];

const fileExists = async (file) => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json,text/plain,*/*",
        "user-agent": "01-football-schedule/0.1 (+https://01-football.vercel.app)"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const fetchText = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,text/plain,*/*",
        "user-agent": "01-football-schedule/0.1 (+https://01-football.vercel.app)"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
};

const writeJson = async (file, payload) => {
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`);
};

const writeText = async (file, payload) => {
  await writeFile(file, String(payload ?? ""));
};

const cacheInfo = async (file) => {
  try {
    const fileStat = await stat(file);
    return {
      exists: true,
      updatedAt: fileStat.mtime.toISOString()
    };
  } catch {
    return {
      exists: false,
      updatedAt: null
    };
  }
};

const sourceStatuses = [];

for (const target of targets) {
  try {
    const payload = target.type === "text" ? await fetchText(target.url) : await fetchJson(target.url);
    if (!target.validate(payload)) {
      throw new Error("unexpected payload shape");
    }
    if (target.type === "text") {
      await writeText(target.file, payload);
    } else {
      await writeJson(target.file, payload);
    }
    sourceStatuses.push({
      name: target.name,
      url: target.url,
      ok: true,
      mode: "live",
      message: "updated from remote source",
      cache: await cacheInfo(target.file),
      checkedAt: new Date().toISOString()
    });
    console.log(`Updated ${target.name}`);
  } catch (error) {
    if (await fileExists(target.file)) {
      sourceStatuses.push({
        name: target.name,
        url: target.url,
        ok: false,
        mode: "cached",
        message: `${error.message}; kept cached file`,
        cache: await cacheInfo(target.file),
        checkedAt: new Date().toISOString()
      });
      console.warn(`Skipped ${target.name}: ${error.message}; kept cached file`);
    } else {
      if (target.type === "text") {
        await writeText(target.file, target.fallback);
      } else {
        await writeJson(target.file, target.fallback);
      }
      sourceStatuses.push({
        name: target.name,
        url: target.url,
        ok: false,
        mode: "fallback",
        message: `${error.message}; initialized empty fallback`,
        cache: await cacheInfo(target.file),
        checkedAt: new Date().toISOString()
      });
      console.warn(`Initialized ${target.name} fallback: ${error.message}`);
    }
  }
}

await writeJson(sourceStatusFile, {
  checkedAt: new Date().toISOString(),
  sources: sourceStatuses
});
