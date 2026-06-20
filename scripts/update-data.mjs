import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceFile = path.join(root, "data", "schedule.seed.json");
const matchesFile = path.join(root, "data", "matches.tsv");
const referenceScheduleFile = path.join(root, "data", "reference-schedule.json");
const cctvRankingsFile = path.join(root, "data", "cctv-rankings.json");
const cctvScorersFile = path.join(root, "data", "cctv-scorers.json");
const publicDir = path.join(root, "public");
const scheduleFile = path.join(publicDir, "schedule.json");
const icsFile = path.join(publicDir, "world-cup-2026.ics");

const stageOrder = [
  "group",
  "round-32",
  "round-16",
  "quarter-final",
  "semi-final",
  "third-place",
  "final"
];

const stageLabels = {
  group: "小组赛",
  "round-32": "三十二强赛",
  "round-16": "十六强赛",
  "quarter-final": "四分之一决赛",
  "semi-final": "半决赛",
  "third-place": "三四名决赛",
  final: "决赛"
};

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const readOptionalJson = async (file, fallback) => {
  try {
    return await readJson(file);
  } catch {
    return fallback;
  }
};

const readTsv = async (file) => {
  const content = await readFile(file, "utf8");
  const [headerLine, ...lines] = content.trim().split(/\r?\n/);
  const headers = headerLine.split("\t");
  return lines.map((line) => {
    const values = line.split("\t");
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const matchNumber = Number(record.matchNumber);
    return {
      id: `m${String(matchNumber).padStart(3, "0")}`,
      matchNumber,
      stage: record.stage,
      stageName: record.stageName,
      group: record.group,
      dateTime: record.dateTime,
      home: record.home,
      away: record.away,
      venue: record.venue || inferVenue(record.city),
      city: record.city,
      country: inferCountry(record.city),
      status: "scheduled",
      sourceStatus: record.sourceStatus
    };
  });
};

const inferCountry = (city) => {
  const mexico = new Set(["墨西哥城", "瓜达拉哈拉", "蒙特雷"]);
  const canada = new Set(["多伦多", "温哥华"]);
  if (mexico.has(city)) return "墨西哥";
  if (canada.has(city)) return "加拿大";
  if (city === "待核对") return "待核对";
  return "美国";
};

const inferVenue = (city) => {
  const venues = {
    墨西哥城: "阿兹特克体育场",
    瓜达拉哈拉: "瓜达拉哈拉体育场",
    蒙特雷: "蒙特雷体育场",
    多伦多: "多伦多体育场",
    温哥华: "温哥华体育场",
    西雅图: "西雅图体育场",
    旧金山: "旧金山湾区体育场",
    旧金山湾区: "旧金山湾区体育场",
    洛杉矶: "洛杉矶体育场",
    休斯敦: "休斯敦体育场",
    达拉斯: "达拉斯体育场",
    堪萨斯城: "堪萨斯城体育场",
    亚特兰大: "亚特兰大体育场",
    迈阿密: "迈阿密体育场",
    波士顿: "波士顿体育场",
    纽约: "纽约/新泽西体育场",
    纽约新泽西: "纽约/新泽西体育场",
    费城: "费城体育场"
  };
  return venues[city] || "待核对";
};

const toUtcStamp = (date) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

const escapeIcs = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const foldLine = (line) => {
  const chunks = [];
  let current = line;
  while (Buffer.byteLength(current, "utf8") > 74) {
    let cut = 74;
    while (Buffer.byteLength(current.slice(0, cut), "utf8") > 74) cut -= 1;
    chunks.push(current.slice(0, cut));
    current = ` ${current.slice(cut)}`;
  }
  chunks.push(current);
  return chunks.join("\r\n");
};

const buildEvent = (match, generatedAt, calendarName = "2026 世界杯赛程") => {
  const start = new Date(match.dateTime);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const summary = `2026 世界杯 #${match.matchNumber} ${match.home} vs ${match.away}`;
  const location = `${match.venue}，${match.city}`;
  const description = [
    `${match.stageName}${match.group ? ` · ${match.group} 组` : ""}`,
    `北京时间：${match.beijingDate} ${match.beijingTime}`,
    `场馆：${match.venue}，${match.city}，${match.country}`,
    `数据状态：${match.sourceStatus}`
  ].join("\\n");

  return [
    "BEGIN:VEVENT",
    `UID:${match.id}-${calendarName}@world-cup-2026.local`,
    `DTSTAMP:${toUtcStamp(generatedAt)}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `LOCATION:${escapeIcs(location)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "END:VEVENT"
  ].map(foldLine).join("\r\n");
};

const enrichMatch = (match) => {
  const date = new Date(match.dateTime);
  const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
  const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  return {
    ...match,
    stageName: match.stageName || stageLabels[match.stage] || match.stage,
    beijingDate: dateFormatter.format(date),
    beijingTime: timeFormatter.format(date),
    isoUtc: date.toISOString()
  };
};

const buildTeamMetaMap = (referenceSchedule) => {
  const teams = referenceSchedule.teams || [];
  const entries = teams.flatMap((team) => [
    [team.zh, team],
    [team.en, team],
    [team.code, team],
    [team.key, team]
  ]);
  return new Map(entries.filter(([key]) => key));
};

const mergeScoreData = (matches, referenceSchedule) => {
  const byNumber = new Map((referenceSchedule.matches || []).map((match) => [match.match_number, match]));
  const teamMeta = buildTeamMetaMap(referenceSchedule);
  return matches.map((match) => {
    const ref = byNumber.get(match.matchNumber);
    const score = ref?.score || {};
    const status = ref?.status || {};
    const homeMeta = teamMeta.get(match.home) || ref?.home || {};
    const awayMeta = teamMeta.get(match.away) || ref?.away || {};
    return {
      ...match,
      homeFlag: homeMeta.flag || "",
      awayFlag: awayMeta.flag || "",
      homeCode: homeMeta.code || homeMeta.country || "",
      awayCode: awayMeta.code || awayMeta.country || "",
      score: {
        home: Number.isFinite(score.home) ? score.home : null,
        away: Number.isFinite(score.away) ? score.away : null,
        homePenalty: Number.isFinite(score.home_penalty) ? score.home_penalty : null,
        awayPenalty: Number.isFinite(score.away_penalty) ? score.away_penalty : null
      },
      matchStatus: {
        key: status.key || (new Date(match.dateTime) < new Date() ? "played" : "upcoming"),
        zh: status.zh || (new Date(match.dateTime) < new Date() ? "已结束" : "未开始")
      },
      sourceStatus: status.key === "played" ? "verified" : match.sourceStatus
    };
  });
};

const normalizeCctvRankings = (payload, teamMeta) => {
  const rankings = payload?.results?.[0]?.rankings || [];
  return rankings.map((group) => ({
    group: group.group,
    teams: (group.ranking || []).map((team, index) => {
      const meta = teamMeta.get(team.teamName) || {};
      return {
        rank: index + 1,
        teamName: team.teamName,
        flag: meta.flag || "",
        code: meta.code || meta.country || "",
        logoUrl: team.logoUrl,
        games: team.games,
        points: team.points,
        wins: team.wins,
        draws: team.draws,
        losses: team.losses,
        goalsFor: team.goalsFor,
        goalsAgainst: team.goalsAgainst,
        goalDifference: team.goalDifference,
        promotionColor: team.promotionColor || ""
      };
    })
  }));
};

const normalizeCctvScorers = (payload, teamMeta) => {
  return (payload?.results || []).slice(0, 20).map((player, index) => {
    const meta = teamMeta.get(player.teamName) || {};
    return {
      rank: index + 1,
      playerId: player.playerId,
      playerName: player.playerName,
      photoUrl: player.photoUrl,
      teamName: player.teamName,
      teamFlag: meta.flag || "",
      teamCode: meta.code || meta.country || "",
      teamLogoUrl: player.teamLogoUrl,
      games: player.games,
      goals: player.goals,
      penaltyGoals: player.penaltyKickGoals
    };
  });
};

const main = async () => {
  const seed = await readJson(sourceFile);
  const rawMatches = await readTsv(matchesFile);
  const referenceSchedule = await readOptionalJson(referenceScheduleFile, { matches: [], meta: {} });
  const cctvRankings = await readOptionalJson(cctvRankingsFile, { results: [] });
  const cctvScorers = await readOptionalJson(cctvScorersFile, { results: [] });
  const generatedAt = new Date();
  const teamMeta = buildTeamMetaMap(referenceSchedule);
  const matches = mergeScoreData(rawMatches.map(enrichMatch), referenceSchedule)
    .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

  const schedule = {
    tournament: seed.tournament,
    timezone: seed.timezone,
    generatedAt: generatedAt.toISOString(),
    lastVerified: seed.lastVerified,
    totalMatchesInTournament: 104,
    includedMatches: matches.length,
    dataCompleteness: "complete-104-match-schedule-with-some-venue-fields-pending",
    stageOrder,
    stageLabels,
    sources: seed.sources,
    completedMatches: referenceSchedule.meta?.completed_count ?? matches.filter((match) => match.matchStatus.key === "played").length,
    standings: normalizeCctvRankings(cctvRankings, teamMeta),
    scorers: normalizeCctvScorers(cctvScorers, teamMeta),
    matches
  };

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Codex//2026 World Cup Schedule//ZH-CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:2026 世界杯赛程",
    "X-WR-TIMEZONE:Asia/Shanghai",
    ...matches.map((match) => buildEvent(match, generatedAt)),
    "END:VCALENDAR"
  ].join("\r\n");

  await mkdir(publicDir, { recursive: true });
  await mkdir(path.join(publicDir, "calendars"), { recursive: true });
  await writeFile(scheduleFile, `${JSON.stringify(schedule, null, 2)}\n`);
  await writeFile(icsFile, `${ics}\r\n`);

  await Promise.all([
    ...stageOrder.map((stage) =>
      writeCalendar(
        path.join(publicDir, "calendars", `stage-${stage}.ics`),
        matches.filter((match) => match.stage === stage),
        generatedAt,
        `2026 世界杯 ${stageLabels[stage]}`
      )
    ),
    ...Array.from(new Set(matches.map((match) => match.group).filter(Boolean))).map((group) =>
      writeCalendar(
        path.join(publicDir, "calendars", `group-${group}.ics`),
        matches.filter((match) => match.group === group),
        generatedAt,
        `2026 世界杯 ${group}组`
      )
    )
  ]);

  console.log(`Wrote ${matches.length} matches to ${path.relative(root, scheduleFile)}`);
  console.log(`Wrote calendar to ${path.relative(root, icsFile)}`);
};

const writeCalendar = async (file, matches, generatedAt, name) => {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Codex//2026 World Cup Schedule//ZH-CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${name}`,
    "X-WR-TIMEZONE:Asia/Shanghai",
    ...matches.map((match) => buildEvent(match, generatedAt, name)),
    "END:VCALENDAR"
  ].join("\r\n");
  await writeFile(file, `${ics}\r\n`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
