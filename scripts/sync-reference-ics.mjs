import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const inputFile = process.argv[2] || path.join(root, "data", "reference-worldcup-2026.ics");
const outputFile = process.argv[3] || path.join(root, "data", "matches.tsv");
const referenceScheduleFile = path.join(path.dirname(inputFile), "reference-schedule.json");

const stageMap = {
  "小组赛": "group",
  "1/16决赛": "round-32",
  "1/8决赛": "round-16",
  "1/4决赛": "quarter-final",
  "半决赛": "semi-final",
  "季军赛": "third-place",
  "决赛": "final"
};

const unfold = (text) => text.replace(/\r?\n[ \t]/g, "");

const parseProps = (event) => {
  const props = {};
  for (const line of unfold(event).split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).split(";")[0];
    if (props[key]) continue;
    props[key] = line.slice(index + 1).replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";");
  }
  return props;
};

const parseDateTime = (stamp) => {
  const match = stamp.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) throw new Error(`Unsupported DTSTART: ${stamp}`);
  const [, year, month, day, hour, minute, second] = match;
  const utc = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
  const beijing = new Date(utc.getTime() + 8 * 60 * 60 * 1000);
  return `${beijing.getUTCFullYear()}-${String(beijing.getUTCMonth() + 1).padStart(2, "0")}-${String(beijing.getUTCDate()).padStart(2, "0")}T${String(beijing.getUTCHours()).padStart(2, "0")}:${String(beijing.getUTCMinutes()).padStart(2, "0")}:00+08:00`;
};

const parseDescription = (description) => {
  const lines = Object.fromEntries(description.split("\n").map((line) => {
    const index = line.indexOf("：");
    return index === -1 ? ["", ""] : [line.slice(0, index), line.slice(index + 1).replace(/\\+$/g, "").trim()];
  }));
  const stageText = lines["阶段"] || "";
  const groupMatch = stageText.match(/([A-L])组/);
  const stageName = stageText.replace(/\s*[A-L]组$/, "").trim();
  return {
    stageName,
    stage: stageMap[stageName] || stageName,
    group: groupMatch?.[1] || "",
    statusText: lines["状态"] || ""
  };
};

const parseLocation = (location) => {
  const [city = "待核对", venue = "待核对"] = location.split(/\s+\/\s+/).map((part) => part.trim());
  return { city, venue };
};

const readReferenceScheduleRows = async () => {
  try {
    const schedule = JSON.parse(await readFile(referenceScheduleFile, "utf8"));
    const matches = schedule.matches || [];
    if (!matches.length) return null;

    return matches.map((match) => ({
      matchNumber: match.match_number,
      stage: stageMap[match.stage?.zh] || stageMap[match.round?.zh] || "group",
      stageName: match.stage?.zh || match.round?.zh || "",
      group: (match.group?.zh || "").replace("组", ""),
      dateTime: `${match.beijing.date}T${match.beijing.time}:00+08:00`,
      home: match.home?.zh || "待定",
      away: match.away?.zh || "待定",
      city: match.venue?.city_zh || "待核对",
      venue: match.venue?.name_en || match.venue?.name_zh || "待核对",
      sourceStatus: match.home?.placeholder || match.away?.placeholder ? "pending-teams" : "verified"
    }));
  } catch {
    return null;
  }
};

const main = async () => {
  const referenceRows = await readReferenceScheduleRows();
  const content = referenceRows ? "" : await readFile(inputFile, "utf8");
  const events = referenceRows ? [] : content.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
  const rows = referenceRows || events.map((event, index) => {
    const props = parseProps(event);
    const description = parseDescription(props.DESCRIPTION || "");
    const location = parseLocation(props.LOCATION || "");
    const [home = "待定", away = "待定"] = (props.SUMMARY || "").split(" vs ");
    return {
      matchNumber: index + 1,
      stage: description.stage,
      stageName: description.stageName,
      group: description.group,
      dateTime: parseDateTime(props.DTSTART),
      home,
      away,
      city: location.city,
      venue: location.venue,
      sourceStatus: /[A-L]\d|胜者|败者/.test(`${home}${away}`) ? "pending-teams" : "verified"
    };
  });

  const header = ["matchNumber", "stage", "stageName", "group", "dateTime", "home", "away", "city", "venue", "sourceStatus"];
  const tsv = [
    header.join("\t"),
    ...rows.map((row) => header.map((key) => row[key] ?? "").join("\t"))
  ].join("\n");
  await writeFile(outputFile, `${tsv}\n`);
  console.log(`Synced ${rows.length} matches to ${path.relative(root, outputFile)}${referenceRows ? " from reference schedule JSON" : ""}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
