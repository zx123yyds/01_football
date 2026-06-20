const stageOptions = [
  ["all", "全部阶段"],
  ["group", "小组赛"],
  ["round-32", "三十二强"],
  ["round-16", "十六强"],
  ["quarter-final", "四分之一"],
  ["semi-final", "半决赛"],
  ["third-place", "三四名"],
  ["final", "决赛"]
];

const state = {
  schedule: null,
  query: "",
  stage: "all",
  group: "all",
  day: "all",
  quick: "all",
  lastGeneratedAt: ""
};

const browserRefreshMs = 2 * 60 * 1000;
const scheduleUrls = ["/schedule.json", "/public/schedule.json"];

const $ = (selector) => document.querySelector(selector);

const dateKey = (value) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date(value));

const cnDate = (value) => new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "long",
  day: "numeric",
  weekday: "long"
}).format(new Date(value));

const fullDateTime = (value) => new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
}).format(new Date(value));

const todayKey = () => dateKey(new Date());

const offsetDateKey = (key, days) => {
  const date = new Date(`${key}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
};

const calendarUrl = () => `${window.location.origin}/world-cup-2026.ics`;
const calendarForCurrentFilters = () => {
  if (state.stage !== "all") return `${window.location.origin}/calendars/stage-${state.stage}.ics`;
  if (state.group !== "all") return `${window.location.origin}/calendars/group-${state.group}.ics`;
  return calendarUrl();
};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const option = (value, label, selectedValue) =>
  `<option value="${escapeHtml(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(label)}</option>`;

const flagBadge = (flag, code = "") => {
  const safeCode = escapeHtml(code);
  if (code) {
    return `<span class="flag-badge" title="${safeCode}" aria-hidden="true"><img src="/flags/${safeCode}.svg" alt="" onerror="this.replaceWith(document.createTextNode('${escapeHtml(flag || code)}'))"></span>`;
  }
  return '<span class="flag-badge flag-badge--empty" aria-hidden="true"></span>';
};

const teamName = (name, flag, code, align = "start") => `
  <span class="team-name team-name--${align}">
    ${align === "end" ? `<span class="team-name__text">${escapeHtml(name)}</span>${flagBadge(flag, code)}` : `${flagBadge(flag, code)}<span class="team-name__text">${escapeHtml(name)}</span>`}
  </span>
`;

function initFilters(matches) {
  const groups = [...new Set(matches.map((match) => match.group).filter(Boolean))].sort();
  const days = [...new Set(matches.map((match) => dateKey(match.dateTime)))].sort();

  $("#stageSelect").innerHTML = stageOptions.map(([value, label]) => option(value, label, state.stage)).join("");
  $("#groupSelect").innerHTML = [
    option("all", "全部小组", state.group),
    ...groups.map((group) => option(group, `${group} 组`, state.group))
  ].join("");
  $("#daySelect").innerHTML = [
    option("all", "全部日期", state.day),
    ...days.map((day) => option(day, cnDate(day), state.day))
  ].join("");
}

function filteredMatches() {
  const matches = state.schedule?.matches ?? [];
  const needle = state.query.trim().toLowerCase();
  const today = todayKey();
  const tomorrow = offsetDateKey(today, 1);
  const upcoming = matches.find((match) => new Date(match.dateTime) >= new Date());

  return matches.filter((match) => {
    const haystack = [
      match.home,
      match.away,
      match.stageName,
      match.group,
      match.city,
      match.venue,
      `#${match.matchNumber}`,
      String(match.matchNumber)
    ].join(" ").toLowerCase();

    return (
      (!needle || haystack.includes(needle)) &&
      (state.stage === "all" || match.stage === state.stage) &&
      (state.group === "all" || match.group === state.group) &&
      (state.day === "all" || dateKey(match.dateTime) === state.day) &&
      (state.quick === "all" ||
        (state.quick === "today" && dateKey(match.dateTime) === today) ||
        (state.quick === "tomorrow" && dateKey(match.dateTime) === tomorrow) ||
        (state.quick === "next" && upcoming && match.id === upcoming.id))
    );
  });
}

function renderSummary() {
  const schedule = state.schedule;
  const matches = schedule.matches;
  const now = new Date();
  const nextMatch = matches.find((match) => new Date(match.dateTime) >= now) ?? matches[0];

  $("#includedMatches").textContent = schedule.includedMatches;
  $("#totalMatches").textContent = schedule.totalMatchesInTournament;
  $("#generatedAt").textContent = new Date(schedule.generatedAt).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai"
  });
  $("#completedMatches").textContent = schedule.completedMatches ?? 0;

  $("#nextTeams").innerHTML = `
    ${teamName(nextMatch.home, nextMatch.homeFlag, nextMatch.homeCode, "end")}
    <span class="next-panel__vs">vs</span>
    ${teamName(nextMatch.away, nextMatch.awayFlag, nextMatch.awayCode)}
  `;
  $("#nextTime").textContent = `${fullDateTime(nextMatch.dateTime)} 北京时间`;
  $("#nextVenue").textContent = `${nextMatch.venue} · ${nextMatch.city}`;
}

function renderSources() {
  $("#sourceList").innerHTML = state.schedule.sources.map((source) => `
    <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
      ${escapeHtml(source.name)}
      <span aria-hidden="true">↗</span>
    </a>
  `).join("");
}

function renderMatches() {
  const matches = filteredMatches();
  $("#matchCount").textContent = `${matches.length} 场`;

  if (!matches.length) {
    $("#scheduleList").innerHTML = '<div class="empty-state">没有符合当前筛选的比赛。</div>';
    return;
  }

  const grouped = matches.reduce((result, match) => {
    const key = dateKey(match.dateTime);
    result[key] = result[key] || [];
    result[key].push(match);
    return result;
  }, {});

  $("#scheduleList").innerHTML = Object.entries(grouped).map(([key, dayMatches]) => `
    <article class="day-group">
      <h3 class="day-group__toggle">${escapeHtml(cnDate(key))}<span class="day-group__count">${dayMatches.length} 场</span></h3>
      <div class="match-list">
        ${dayMatches.map(renderMatchCard).join("")}
      </div>
    </article>
  `).join("");

  document.querySelectorAll(".day-group__toggle").forEach((h3) => {
    h3.addEventListener("click", () => {
      h3.closest(".day-group").classList.toggle("is-collapsed");
    });
  });
}

function renderMatchCard(match) {
  const statusLabel = match.matchStatus?.zh || (match.sourceStatus === "verified" ? "已核对" : "球队待定");
  const hasScore = Number.isFinite(match.score?.home) && Number.isFinite(match.score?.away);
  const scoreText = hasScore
    ? `${match.score.home} - ${match.score.away}${Number.isFinite(match.score.homePenalty) && Number.isFinite(match.score.awayPenalty) ? ` (${match.score.homePenalty}-${match.score.awayPenalty})` : ""}`
    : "VS";
  return `
    <article class="match-card match-card--${hasScore ? "played" : "upcoming"}">
      <div class="match-card__meta">
        <span>#${escapeHtml(match.matchNumber)}</span>
        <span>${escapeHtml(match.stageName)}${match.group ? ` · ${escapeHtml(match.group)} 组` : ""}</span>
        <span class="status status--${escapeHtml(match.matchStatus?.key || match.sourceStatus)}">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="match-card__teams">
        ${teamName(match.home, match.homeFlag, match.homeCode, "end")}
        <span class="score-box ${hasScore ? "score-box--played" : ""}">${escapeHtml(scoreText)}</span>
        ${teamName(match.away, match.awayFlag, match.awayCode)}
      </div>
      <div class="match-card__details">
        <span>${escapeHtml(fullDateTime(match.dateTime))} 北京时间</span>
        <span>${escapeHtml(match.venue)} · ${escapeHtml(match.city)}</span>
      </div>
    </article>
  `;
}

function renderStandings() {
  const groups = state.schedule.standings || [];
  $("#standingsList").innerHTML = groups.map((group, index) => `
    <section class="standings-card standings-card--tone-${index % 6}">
      <header class="standings-card__hero">
        <span>${escapeHtml(group.group)}</span>
        <strong>${teamName(group.teams[0]?.teamName || "", group.teams[0]?.flag, group.teams[0]?.code)}</strong>
        <em>${group.teams[0]?.points ?? 0} 分 · 净胜 ${formatGoalDiff(group.teams[0]?.goalDifference ?? 0)}</em>
      </header>
      <div class="standing-rows">
        <div class="standing-row standing-row--head" aria-hidden="true">
          <span>排</span>
          <strong>球队</strong>
          <span>赛</span>
          <span>胜平负</span>
          <span>净胜</span>
          <b>分</b>
        </div>
        ${group.teams.map((team) => `
          <div class="standing-row ${team.rank <= 2 ? "standing-row--advance" : ""}">
            <span class="rank">${team.rank}</span>
            <strong>${teamName(team.teamName, team.flag, team.code)}</strong>
            <span>${team.games} 赛</span>
            <span>${team.wins}-${team.draws}-${team.losses}</span>
            <span>${formatGoalDiff(team.goalDifference)}</span>
            <b>${team.points}</b>
          </div>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function renderScorers() {
  const scorers = state.schedule.scorers || [];
  $("#scorersList").innerHTML = scorers.map((player) => `
    <article class="scorer-row ${player.rank <= 3 ? `scorer-row--top scorer-row--top-${player.rank}` : ""}">
      <span class="scorer-rank">${player.rank}</span>
      <img src="${escapeHtml(player.photoUrl || player.teamLogoUrl || "")}" alt="" loading="lazy" />
      <div>
        <strong>${escapeHtml(player.playerName)}</strong>
        <p>${flagBadge(player.teamFlag, player.teamCode)}<span>${escapeHtml(player.teamName)} · ${player.games} 场</span></p>
      </div>
      <span class="goals">${player.goals}</span>
    </article>
  `).join("");
}

function formatGoalDiff(value) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function setQuickFilter(value) {
  state.quick = value;
  if (value !== "all") {
    state.query = "";
    state.day = "all";
    $("#searchInput").value = "";
    initFilters(state.schedule.matches);
  }
  document.querySelectorAll(".quick-chip").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.quick === value);
  });
  renderMatches();
}

function render() {
  renderSummary();
  renderSources();
  initFilters(state.schedule.matches);
  renderMatches();
  renderStandings();
  renderScorers();
}

function bindEvents() {
  $("#searchInput").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderMatches();
  });
  $("#stageSelect").addEventListener("change", (event) => {
    state.stage = event.target.value;
    renderMatches();
  });
  $("#groupSelect").addEventListener("change", (event) => {
    state.group = event.target.value;
    renderMatches();
  });
  $("#daySelect").addEventListener("change", (event) => {
    state.day = event.target.value;
    renderMatches();
  });
  $("#resetFilters").addEventListener("click", () => {
    state.query = "";
    state.stage = "all";
    state.group = "all";
    state.day = "all";
    state.quick = "all";
    $("#searchInput").value = "";
    initFilters(state.schedule.matches);
    setQuickFilter("all");
  });
  document.querySelectorAll(".quick-chip").forEach((chip) => {
    chip.addEventListener("click", () => setQuickFilter(chip.dataset.quick));
  });
  $("#copyCalendar").addEventListener("click", async (event) => {
    await navigator.clipboard.writeText(calendarForCurrentFilters());
    const button = event.currentTarget;
    const original = button.innerHTML;
    button.innerHTML = '<span aria-hidden="true">Cal</span>已复制订阅地址';
    window.setTimeout(() => {
      button.innerHTML = original;
    }, 1600);
  });
  $("#downloadFiltered").addEventListener("click", () => {
    window.location.href = calendarForCurrentFilters();
  });
}

async function loadSchedule({ silent = false } = {}) {
  let schedule = null;
  let lastError = null;
  for (const url of scheduleUrls) {
    try {
      const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`${url} returned ${response.status}`);
      schedule = await response.json();
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!schedule) throw lastError || new Error("Unable to load schedule data");
  const changed = schedule.generatedAt !== state.lastGeneratedAt;
  state.schedule = schedule;
  state.lastGeneratedAt = schedule.generatedAt;
  if (!silent || changed) render();
}

async function start() {
  await loadSchedule();
  bindEvents();
  window.setInterval(() => {
    loadSchedule({ silent: true }).catch((error) => console.warn("Schedule refresh failed", error));
  }, browserRefreshMs);
}

start().catch((error) => {
  console.error(error);
  $("#scheduleList").innerHTML = '<div class="empty-state">赛程载入失败，请检查 schedule.json。</div>';
});
