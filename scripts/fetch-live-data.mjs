import { access, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

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

const writeJson = async (file, payload) => {
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`);
};

for (const target of targets) {
  try {
    const payload = await fetchJson(target.url);
    if (!target.validate(payload)) {
      throw new Error("unexpected payload shape");
    }
    await writeJson(target.file, payload);
    console.log(`Updated ${target.name}`);
  } catch (error) {
    if (await fileExists(target.file)) {
      console.warn(`Skipped ${target.name}: ${error.message}; kept cached file`);
    } else {
      await writeJson(target.file, target.fallback);
      console.warn(`Initialized ${target.name} fallback: ${error.message}`);
    }
  }
}
