import { chromium } from "playwright";
import path from "node:path";

const root = process.cwd();
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5173";

const browser = await chromium.launch({ headless: true });

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  await desktop.waitForSelector(".match-card");

  const desktopInfo = await desktop.evaluate(() => ({
    title: document.title,
    h1: document.querySelector("h1")?.textContent,
    cards: document.querySelectorAll(".match-card").length,
    count: document.querySelector("#matchCount")?.textContent,
    next: document.querySelector("#nextTeams")?.textContent,
    generated: document.querySelector("#generatedAt")?.textContent,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    icsHref: document.querySelector('a[href="/world-cup-2026.ics"]')?.getAttribute("href"),
    quickLabels: [...document.querySelectorAll(".quick-chip")].map((el) => el.textContent.trim())
  }));
  const tableInfo = await desktop.evaluate(() => ({
    playedScores: [...document.querySelectorAll(".score-box--played")].length,
    standingsGroups: document.querySelectorAll(".standings-card").length,
    scorerRows: document.querySelectorAll(".scorer-row").length,
    flags: document.querySelectorAll(".flag-badge:not(.flag-badge--empty)").length
  }));

  await desktop.fill("#searchInput", "阿根廷");
  await desktop.waitForTimeout(120);
  const searchInfo = await desktop.evaluate(() => ({
    count: document.querySelector("#matchCount").textContent,
    cards: document.querySelectorAll(".match-card").length,
    text: document.querySelector("#scheduleList").textContent.slice(0, 120)
  }));

  await desktop.click('[data-quick="next"]');
  await desktop.waitForTimeout(120);
  const nextInfo = await desktop.evaluate(() => ({
    count: document.querySelector("#matchCount").textContent,
    cards: document.querySelectorAll(".match-card").length,
    active: document.querySelector(".quick-chip.is-active")?.textContent.trim()
  }));

  await desktop.click('[data-quick="all"]');
  await desktop.fill("#searchInput", "");
  await desktop.selectOption("#stageSelect", "final");
  await desktop.waitForTimeout(120);
  const finalInfo = await desktop.evaluate(() => ({
    count: document.querySelector("#matchCount").textContent,
    cards: document.querySelectorAll(".match-card").length
  }));

  const icsResponse = await desktop.request.get(`${baseUrl}/world-cup-2026.ics`);
  const icsText = await icsResponse.text();
  const icsInfo = {
    status: icsResponse.status(),
    events: icsText.match(/BEGIN:VEVENT/g)?.length ?? 0,
    hasCalendar: icsText.includes("BEGIN:VCALENDAR")
  };

  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  await desktop.screenshot({ path: path.join(root, "public", "desktop-verification.png"), fullPage: true });

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 2
  });
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  await mobile.waitForSelector(".match-card");
  const mobileInfo = await mobile.evaluate(() => ({
    cards: document.querySelectorAll(".match-card").length,
    count: document.querySelector("#matchCount")?.textContent,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    heroHeight: Math.round(document.querySelector(".hero").getBoundingClientRect().height),
    toolbarTop: Math.round(document.querySelector(".toolbar").getBoundingClientRect().top)
  }));
  await mobile.screenshot({ path: path.join(root, "public", "mobile-verification.png"), fullPage: true });

  const failures = [];
  if (desktopInfo.cards !== 104 || desktopInfo.count !== "104 场") failures.push("desktop does not show 104 matches");
  if (tableInfo.playedScores < 1) failures.push("scores are not rendered");
  if (tableInfo.standingsGroups !== 12) failures.push("standings are not rendered");
  if (tableInfo.scorerRows < 5) failures.push("scorers are not rendered");
  if (tableInfo.flags < 100) failures.push("team flags are not rendered");
  if (!desktopInfo.quickLabels.includes("今日") || !desktopInfo.quickLabels.includes("明日") || !desktopInfo.quickLabels.includes("下一场")) failures.push("quick filters missing");
  if (desktopInfo.overflow) failures.push("desktop horizontal overflow");
  if (searchInfo.cards < 1 || !searchInfo.text.includes("阿根廷")) failures.push("search filter failed");
  if (nextInfo.cards !== 1 || nextInfo.active !== "下一场") failures.push("next quick filter failed");
  if (finalInfo.cards !== 1) failures.push("final stage filter failed");
  if (icsInfo.status !== 200 || icsInfo.events !== 104 || !icsInfo.hasCalendar) failures.push("ICS endpoint failed");
  if (mobileInfo.cards !== 104 || mobileInfo.overflow) failures.push("mobile layout failed");

  const result = { desktopInfo, tableInfo, searchInfo, nextInfo, finalInfo, icsInfo, mobileInfo };
  console.log(JSON.stringify(result, null, 2));
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
