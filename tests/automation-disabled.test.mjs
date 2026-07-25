import assert from "node:assert/strict";
import { access, chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("scheduled GitHub data refresh workflow is disabled", async () => {
  const activeWorkflow = path.join(root, ".github", "workflows", "update-schedule.yml");
  const disabledWorkflow = `${activeWorkflow}.disabled`;

  await assert.rejects(access(activeWorkflow), { code: "ENOENT" });
  await access(disabledWorkflow);
});

test("development server does not trigger external data refresh", { timeout: 10_000 }, async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "football-static-server-"));
  const fakeNpm = path.join(tempDir, "npm");
  const refreshMarker = path.join(tempDir, "refresh-called");
  await writeFile(fakeNpm, '#!/bin/sh\nprintf "called" > "$REFRESH_MARKER"\n');
  await chmod(fakeNpm, 0o755);

  const child = spawn(process.execPath, [path.join(root, "scripts", "serve.mjs")], {
    cwd: root,
    env: {
      ...process.env,
      PATH: `${tempDir}:${process.env.PATH}`,
      PORT: "0",
      REFRESH_MARKER: refreshMarker
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  t.after(async () => {
    child.kill("SIGTERM");
    await rm(tempDir, { recursive: true, force: true });
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server did not start:\n${output}`)), 3_000);
    const checkOutput = () => {
      if (!output.includes("Local dev server started successfully.")) return;
      clearTimeout(timeout);
      resolve();
    };
    child.stdout.on("data", checkOutput);
    child.stderr.on("data", checkOutput);
  });
  await new Promise((resolve) => setTimeout(resolve, 250));

  const refreshTriggered = await access(refreshMarker).then(() => true, () => false);
  assert.equal(refreshTriggered, false, "npm run refresh was triggered");
  assert.match(output, /External data refresh is disabled/);
});
