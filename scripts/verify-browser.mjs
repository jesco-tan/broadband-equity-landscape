// Non-build browser checks against an already running development server.
// BROWSER_PATH can point at an existing Chromium installation.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { cpus, totalmem } from "node:os";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const results = {
  checks: [],
  environment: {
    browser: browser.version(),
    platform: process.platform,
    cpu: cpus()[0].model,
    logicalCpus: cpus().length,
    memoryGiB: Math.round(totalmem() / 2 ** 30),
    browserViewport: [1440, 1050],
    date: new Date().toISOString(),
  },
};
const check = (name) => results.checks.push(name);
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const url = "http://127.0.0.1:5174/";
try {
  await page.goto(url);
  await page.waitForSelector("#map canvas");
  await page.waitForFunction(
    () => window.broadbandDiagnostics?.().firstMapMs > 0,
  );
  results.initialNavigation = await page.evaluate(() => ({
    firstMapMs: window.broadbandDiagnostics().firstMapMs,
    documentTiming: performance.getEntriesByType("navigation")[0].toJSON(),
  }));
  // Measure the warm document load separately from a fresh browser connection.
  await page.reload();
  await page.waitForSelector("#map canvas");
  await page.waitForFunction(
    () => window.broadbandDiagnostics?.().firstMapMs > 0,
  );
  assert.equal(await page.locator("#coverage-value").textContent(), "100.0%");
  assert.equal(
    await page.locator("#tilted").getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await page.locator(".segmented button").first().getAttribute("id"),
    "tilted",
  );
  check("Initial 3D state and WebGL map loaded");
  assert.equal(await page.locator("#controls select").count(), 0);
  await page.locator('#layer input[value="adoption"]').focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page.locator("#layer input:checked").inputValue(),
    "income",
  );
  await page.locator("#resume").click();
  check("Visible choice groups support native keyboard navigation");
  await page.locator("#reading-guide summary").click();
  assert.equal(await page.locator("#reading-guide").getAttribute("open"), "");
  assert.match(
    await page.locator("#reading-guide").textContent(),
    /stand-in for household counts/,
  );
  await page.locator("#reading-guide summary").click();
  check("Plain-language terminology guide opens and closes");
  const firstCanvas = await page.locator("#map canvas").boundingBox();
  await page.mouse.click(
    firstCanvas.x + firstCanvas.width / 2 + 13,
    firstCanvas.y + firstCanvas.height / 2 + 11,
  );
  assert.equal(await page.locator("#mode-label").textContent(), "Guided story");
  assert.ok(await page.locator(".detail-id").count());
  assert.equal(await page.locator("#selected-panel").isVisible(), true);
  assert.equal(await page.locator("#story-content").isVisible(), false);
  const selectedMap = await page.evaluate(
    () => window.broadbandDiagnostics().selection,
  );
  assert.equal(selectedMap.id, await page.locator(".detail-id").textContent());
  assert.ok(selectedMap.parts > 0);
  assert.equal(selectedMap.outlineWidth, 1.5);
  check(
    "Pointer inspection opens adjacent details and a wide selected-cell outline",
  );
  check("Pointer inspection does not leave the guided story");
  await page.locator("#next").click();
  assert.equal(await page.locator("#story-content").isVisible(), true);
  assert.equal(await page.locator("#selected-panel").isVisible(), false);
  assert.equal(
    await page.locator("#story-title").textContent(),
    "Cold spots reveal a pattern.",
  );
  assert.equal(
    (await page.evaluate(() => window.broadbandDiagnostics())).selection.id,
    selectedMap.id,
  );
  check(
    "Next chapter restores visible story content while retaining map selection",
  );
  assert.equal(await page.locator("#coverage-value").textContent(), "22.9%");
  assert.equal(await page.locator("#covered-value").textContent(), "119,165");
  assert.equal(await page.locator("#excluded-value").textContent(), "401,987");
  check("LL story totals match source");
  await page.locator("#search").fill("urban");
  await page.locator("[data-id]").first().focus();
  await page.keyboard.press("Enter");
  const inspected = await page.locator(".detail-id").textContent();
  assert.equal(
    await page
      .locator("#selected-panel")
      .evaluate((node) => node.parentElement.id),
    "list-details-slot",
  );
  assert.equal(await page.locator("#list-details-slot").isVisible(), true);
  assert.equal(await page.locator("#story-content").isVisible(), true);
  check(
    "List inspection shows details beside the list while keeping the story visible",
  );
  assert.equal(await page.locator("#mode-label").textContent(), "Guided story");
  assert.equal(await page.locator("#covered-value").textContent(), "119,165");
  assert.equal(
    await page
      .locator("#selected-heading")
      .evaluate((node) => node === document.activeElement),
    true,
  );
  check("Keyboard inspection and search preserve story and totals");
  await page.locator("#next").click();
  await page.waitForTimeout(800);
  assert.equal(await page.locator(".detail-id").textContent(), inspected);
  assert.equal(
    await page.locator("#tilted").getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#next").click();
  await page.waitForTimeout(100);
  assert.equal(
    await page.locator("#emphasis input:checked").inputValue(),
    "outside",
  );
  assert.equal(await page.locator("#covered-value").textContent(), "119,165");
  check("3D and outside emphasis preserve inspection and targeting");
  await page.locator('#layer input[value="income"]').check();
  assert.equal(
    await page.locator("#mode-label").textContent(),
    "Free exploration",
  );
  await page.locator("#resume").click();
  assert.equal(await page.locator("#layer input:checked").inputValue(), "lisa");
  check("Manual controls explore; resume reapplies current step");
  await page.locator("#flat").click();
  await page.waitForTimeout(800);
  assert.equal(
    await page.locator("#targeting input:checked").inputValue(),
    "ll",
  );
  await page.locator("#clear").click();
  assert.equal(await page.locator("#list-details-slot").isVisible(), false);
  assert.equal(await page.locator("#story-content").isVisible(), true);
  assert.equal(
    (await page.evaluate(() => window.broadbandDiagnostics())).selection.parts,
    0,
  );
  check(
    "Closing selected-area details restores the story and removes the outline",
  );
  const canvas = page.locator("#map canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.click(
    box.x + box.width / 2 + 13,
    box.y + box.height / 2 + 11,
  );
  assert.ok(await page.locator(".detail-id").count());
  assert.equal(await page.locator("#selected-panel").isVisible(), true);
  assert.ok(
    (await page.evaluate(() => window.broadbandDiagnostics())).selection.parts >
      0,
  );
  check("Flat map footprint is pickable");
  await canvas.screenshot({ path: "docs/map-flat.png" });
  await page.locator("#restart").click();
  assert.equal(await page.locator("#search").inputValue(), "");
  assert.equal(await page.locator(".detail-id").count(), 0);
  assert.equal(await page.locator("#coverage-value").textContent(), "100.0%");
  check("Restart resets inspection, search and coverage");
  await page.locator("#tilted").click();
  await page.waitForTimeout(800);
  await canvas.scrollIntoViewIfNeeded();
  const gestureBox = await canvas.boundingBox();
  await page.mouse.move(
    gestureBox.x + gestureBox.width / 2,
    gestureBox.y + gestureBox.height / 2,
  );
  await page.mouse.down();
  const interactionStart = performance.now();
  let i = 0;
  while (performance.now() - interactionStart < 10000) {
    await page.mouse.move(
      gestureBox.x + gestureBox.width / 2 + Math.sin(i / 30) * 70,
      gestureBox.y + gestureBox.height / 2 + Math.cos(i / 40) * 30,
    );
    await page.waitForTimeout(12);
    i++;
  }
  await page.mouse.up();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  results.rendering = await page.evaluate(() => window.broadbandDiagnostics());
  const frameCount = results.rendering.frames;
  await page.waitForTimeout(500);
  assert.equal(
    (await page.evaluate(() => window.broadbandDiagnostics())).frames,
    frameCount,
  );
  check("Rendering stops while idle");
  await page.screenshot({ path: "docs/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(150);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.locator("#search").fill("060000017");
  await page.locator("[data-id]").first().click();
  await page.waitForTimeout(600);
  assert.equal(await page.locator("#selected-panel").isVisible(), true);
  const mobileDetail = await page.locator("#selected-panel").boundingBox();
  assert.ok(mobileDetail.y >= 0 && mobileDetail.y < 800);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  check(
    "Mobile area selection brings details into view without horizontal overflow",
  );
  await page.screenshot({ path: "docs/mobile.png", fullPage: true });
  check("360px layout has no horizontal page overflow");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#flat").click();
  await page.locator("#tilted").click();
  const frameNow = (await page.evaluate(() => window.broadbandDiagnostics()))
    .frames;
  await page.waitForTimeout(250);
  const afterMotion = (await page.evaluate(() => window.broadbandDiagnostics()))
    .frames;
  assert.ok(afterMotion - frameNow <= 3);
  check("Reduced motion does not run an animated camera transition");
  await page.goto(`${url}?renderer=table`);
  await page.waitForSelector(".fallback");
  await page.locator('#targeting input[value="ll"]').check();
  assert.equal(await page.locator("#coverage-value").textContent(), "22.9%");
  await page.locator("#search").fill("060000000");
  await page.locator("[data-id]").first().click();
  assert.ok(await page.locator(".detail-id").count());
  check("Forced table fallback retains controls, metrics and inspection");
  await page.goto(url);
  await page.waitForSelector("#map canvas");
  await page.evaluate(() =>
    document
      .querySelector("canvas")
      .getContext("webgl2")
      .getExtension("WEBGL_lose_context")
      .loseContext(),
  );
  await page.waitForSelector(".fallback");
  await page.locator('#targeting input[value="ll"]').check();
  assert.equal(await page.locator("#coverage-value").textContent(), "22.9%");
  check("Actual graphics context loss retains analytical interface");
  const disposed = await page.evaluate(() => window.broadbandDiagnostics());
  assert.equal(disposed.disposed, true);
  assert.equal(disposed.memory.geometries, 0);
  assert.equal(disposed.contextLost, true);
  results.teardown = disposed;
  check("Teardown releases all tracked geometries and loses the GPU context");
  await page.route("**/data/broadband-synthetic.v1.json", (route) =>
    route.fulfill({ status: 404, body: "Missing" }),
  );
  await page.goto(url);
  await page.waitForSelector("#retry");
  assert.match(await page.locator("[role=alert]").textContent(), /404/);
  check("Failed dataset fetch provides retry and regeneration guidance");
  await page.unroute("**/data/broadband-synthetic.v1.json");
  await page.route("**/data/broadband-synthetic.v1.json", (route) =>
    route.fulfill({ json: { schemaVersion: 99 } }),
  );
  await page.goto(url);
  await page.waitForSelector("#retry");
  assert.match(await page.locator("[role=alert]").textContent(), /schema/);
  check("Malformed dataset is rejected before analytical rendering");
  assert.deepEqual(errors, []);
  check("No uncaught page errors");
} finally {
  results.errors = errors;
  await writeFile(
    "docs/browser-verification.json",
    JSON.stringify(results, null, 2) + "\n",
  );
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
