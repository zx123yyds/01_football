import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "index.html",
  "src/main.js",
  "src/styles.css",
  "public/schedule.json",
  "public/world-cup-2026.ics",
  "public/calendars/stage-group.ics",
  "public/calendars/group-A.ics",
  "scripts/sync-reference-ics.mjs"
];

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

for (const file of requiredFiles) {
  await access(path.join(root, file)).catch(() => fail(`Missing ${file}`));
}

const schedule = JSON.parse(await readFile(path.join(root, "public/schedule.json"), "utf8"));
const ics = await readFile(path.join(root, "public/world-cup-2026.ics"), "utf8");
const groupIcs = await readFile(path.join(root, "public/calendars/stage-group.ics"), "utf8");
const groupAIcs = await readFile(path.join(root, "public/calendars/group-A.ics"), "utf8");
const html = await readFile(path.join(root, "index.html"), "utf8");
const app = await readFile(path.join(root, "src/main.js"), "utf8");
const css = await readFile(path.join(root, "src/styles.css"), "utf8");

if (!Array.isArray(schedule.matches) || schedule.matches.length !== 104) {
  fail("schedule.json must include all 104 tournament matches.");
}

if (!schedule.matches.every((match) => match.dateTime && match.home && match.away && match.stage)) {
  fail("schedule.json has matches missing required fields.");
}

if (!schedule.matches.some((match) => match.matchStatus?.key === "played" && Number.isFinite(match.score?.home) && Number.isFinite(match.score?.away))) {
  fail("schedule.json does not include verified score data.");
}

const staleUpcomingMatches = schedule.matches.filter((match) => {
  const start = new Date(match.dateTime);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return Date.now() >= end.getTime() && match.matchStatus?.key === "upcoming";
});
if (staleUpcomingMatches.length) {
  fail(`Past matches are still marked upcoming: ${staleUpcomingMatches.map((match) => `#${match.matchNumber}`).join(", ")}`);
}

const unresolvedPlayedTeams = schedule.matches.filter((match) =>
  match.matchStatus?.key === "played" &&
  (/[A-L]\d|胜者|败者/.test(`${match.home}${match.away}`) || !match.homeCode || !match.awayCode)
);
if (unresolvedPlayedTeams.length) {
  fail(`Played matches still have unresolved teams: ${unresolvedPlayedTeams.map((match) => `#${match.matchNumber}`).join(", ")}`);
}

if (!schedule.matches.some((match) => match.homeFlag && match.awayFlag)) {
  fail("schedule.json does not include team flags for matches.");
}

if (!Array.isArray(schedule.standings) || schedule.standings.length !== 12) {
  fail("schedule.json does not include 12 group standings.");
}

if (!Array.isArray(schedule.scorers) || schedule.scorers.length < 5) {
  fail("schedule.json does not include scorer table data.");
}

if (!schedule.sourceHealth || !Array.isArray(schedule.sourceHealth.sources) || schedule.sourceHealth.sources.length < 3) {
  fail("schedule.json does not include source health metadata.");
}

if (!schedule.standings.some((group) => group.teams?.some((team) => team.flag)) || !schedule.scorers.some((player) => player.teamFlag)) {
  fail("standings or scorers are missing team flags.");
}

if (schedule.matches.some((match) => !match.venue || match.venue === "待核对")) {
  fail("schedule.json has matches missing verified venue names.");
}

const eventCount = ics.match(/BEGIN:VEVENT/g)?.length ?? 0;
if (!ics.includes("BEGIN:VCALENDAR") || eventCount !== 104 || !ics.includes("X-WR-CALNAME:2026 世界杯赛程")) {
  fail("ICS output is missing calendar markers.");
}

if ((groupIcs.match(/BEGIN:VEVENT/g)?.length ?? 0) !== 72 || (groupAIcs.match(/BEGIN:VEVENT/g)?.length ?? 0) !== 6) {
  fail("Stage or group calendar event counts are incorrect.");
}

if (!html.includes("/world-cup-2026.ics") || !html.includes("downloadFiltered") || !app.includes("schedule.json")) {
  fail("index.html is missing calendar or schedule wiring.");
}

if (!html.includes('data-quick="today"') || !html.includes('data-quick="tomorrow"') || !html.includes('data-quick="next"')) {
  fail("Quick filters for today, tomorrow, and next match are missing.");
}

for (const selector of ["searchInput", "stageSelect", "groupSelect", "daySelect", "resetFilters", "scheduleList"]) {
  if (!html.includes(`id="${selector}"`) || !app.includes(`#${selector}`)) {
    fail(`UI control ${selector} is not wired in both HTML and JS.`);
  }
}

if (!app.includes("filteredMatches") || !app.includes("calendarForCurrentFilters") || !app.includes("setQuickFilter")) {
  fail("Filtering or filtered calendar behavior is missing from app code.");
}

if (!css.includes("@media (max-width: 900px)") || !css.includes("@media (max-width: 560px)")) {
  fail("Responsive CSS breakpoints are missing.");
}

console.log(`Validated static site with ${schedule.matches.length} matches and ${eventCount} calendar events.`);
