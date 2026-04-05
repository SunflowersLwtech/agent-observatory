/**
 * Agent Observatory — Hackathon Demo Recording Script
 *
 * Records key product flows as video segments for the demo video.
 * Each scene captures a distinct product capability with smooth scrolling
 * and realistic interactions.
 *
 * Usage:
 *   npx tsx demo/scripts/record-demo.ts [scene]
 *
 * Scenes:
 *   landing    — Landing page & Auth0 login flow
 *   chat       — Agent chat with tool calls
 *   observatory — Observatory dashboard with live events
 *   debugger   — Token Vault debugger
 *   stepup     — Step-up authorization (write op blocking)
 *   scope      — Scope toggle & FGA authorization
 *   all        — Record all scenes sequentially
 */

import { chromium, type Page, type Browser, type BrowserContext } from "playwright";
import { join } from "path";

const BASE_URL = process.env.DEMO_URL ?? "http://localhost:3000";
const OUTPUT_DIR = join(__dirname, "..", "recordings");
const VIEWPORT = { width: 1920, height: 1080 };
const SLOW_MO = 80; // Slight slowdown for readability

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function smoothScroll(page: Page, distance: number, duration = 1500) {
  const steps = 30;
  const stepDist = distance / steps;
  const stepTime = duration / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepDist);
    await wait(stepTime);
  }
}

async function typeSlowly(page: Page, selector: string, text: string, delay = 50) {
  await page.click(selector);
  await page.type(selector, text, { delay });
}

async function takeSceneScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: join(OUTPUT_DIR, `${name}.png`),
    fullPage: false,
  });
}

// ---------------------------------------------------------------------------
// Scene: Landing Page
// ---------------------------------------------------------------------------

async function sceneLanding(page: Page) {
  console.log("[Scene: Landing] Starting...");

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await wait(2000);
  await takeSceneScreenshot(page, "01-landing");

  // Scroll through the landing page
  await smoothScroll(page, 600);
  await wait(1000);
  await takeSceneScreenshot(page, "02-landing-features");

  console.log("[Scene: Landing] Done.");
}

// ---------------------------------------------------------------------------
// Scene: Chat with Agent
// ---------------------------------------------------------------------------

async function sceneChat(page: Page) {
  console.log("[Scene: Chat] Starting...");

  await page.goto(`${BASE_URL}/dashboard/chat`, { waitUntil: "networkidle" });
  await wait(2000);
  await takeSceneScreenshot(page, "03-chat-empty");

  // Type a calendar query
  const chatInput = 'textarea, input[type="text"], [contenteditable="true"]';
  await typeSlowly(page, chatInput, "Check my calendar availability for tomorrow 9am-5pm");
  await wait(500);
  await takeSceneScreenshot(page, "04-chat-typing");

  // Submit (press Enter)
  await page.keyboard.press("Enter");
  await wait(5000); // Wait for AI response + tool call
  await takeSceneScreenshot(page, "05-chat-calendar-response");

  // Try GitHub
  await typeSlowly(page, chatInput, "Show my recent GitHub repositories");
  await page.keyboard.press("Enter");
  await wait(5000);
  await takeSceneScreenshot(page, "06-chat-github-response");

  // Try Slack channels (read — should work)
  await typeSlowly(page, chatInput, "List my Slack channels");
  await page.keyboard.press("Enter");
  await wait(5000);
  await takeSceneScreenshot(page, "07-chat-slack-channels");

  console.log("[Scene: Chat] Done.");
}

// ---------------------------------------------------------------------------
// Scene: Step-Up Authorization
// ---------------------------------------------------------------------------

async function sceneStepUp(page: Page) {
  console.log("[Scene: StepUp] Starting...");

  await page.goto(`${BASE_URL}/dashboard/chat`, { waitUntil: "networkidle" });
  await wait(2000);

  // Request a write operation — should trigger step-up
  const chatInput = 'textarea, input[type="text"], [contenteditable="true"]';
  await typeSlowly(page, chatInput, "Send a message to #general saying 'Hello from Agent Observatory!'");
  await page.keyboard.press("Enter");
  await wait(6000); // Wait for step-up prompt
  await takeSceneScreenshot(page, "08-stepup-prompted");

  // Confirm the operation
  await typeSlowly(page, chatInput, "Yes, proceed with the message");
  await page.keyboard.press("Enter");
  await wait(5000);
  await takeSceneScreenshot(page, "09-stepup-confirmed");

  console.log("[Scene: StepUp] Done.");
}

// ---------------------------------------------------------------------------
// Scene: Observatory Dashboard
// ---------------------------------------------------------------------------

async function sceneObservatory(page: Page) {
  console.log("[Scene: Observatory] Starting...");

  await page.goto(`${BASE_URL}/dashboard/observatory`, { waitUntil: "networkidle" });
  await wait(3000);
  await takeSceneScreenshot(page, "10-observatory-overview");

  // Scroll to risk timeline
  await smoothScroll(page, 500);
  await wait(2000);
  await takeSceneScreenshot(page, "11-observatory-risk-timeline");

  // Scroll to OWASP mapping
  await smoothScroll(page, 500);
  await wait(2000);
  await takeSceneScreenshot(page, "12-observatory-owasp");

  // Scroll to credential correlation
  await smoothScroll(page, 500);
  await wait(2000);
  await takeSceneScreenshot(page, "13-observatory-correlation");

  console.log("[Scene: Observatory] Done.");
}

// ---------------------------------------------------------------------------
// Scene: Token Vault Debugger
// ---------------------------------------------------------------------------

async function sceneDebugger(page: Page) {
  console.log("[Scene: Debugger] Starting...");

  await page.goto(`${BASE_URL}/dashboard/debugger`, { waitUntil: "networkidle" });
  await wait(3000);
  await takeSceneScreenshot(page, "14-debugger-overview");

  // Scroll to connection details
  await smoothScroll(page, 400);
  await wait(2000);
  await takeSceneScreenshot(page, "15-debugger-connections");

  // Scroll to known errors
  await smoothScroll(page, 400);
  await wait(2000);
  await takeSceneScreenshot(page, "16-debugger-known-errors");

  console.log("[Scene: Debugger] Done.");
}

// ---------------------------------------------------------------------------
// Scene: Scope Toggle (FGA)
// ---------------------------------------------------------------------------

async function sceneScope(page: Page) {
  console.log("[Scene: Scope] Starting...");

  await page.goto(`${BASE_URL}/dashboard/observatory`, { waitUntil: "networkidle" });
  await wait(3000);

  // Scroll to Permission Landscape section
  await smoothScroll(page, 1200);
  await wait(2000);
  await takeSceneScreenshot(page, "17-scope-permissions");

  // Try toggling a scope (click a toggle if visible)
  const toggles = page.locator('button[role="switch"], [data-scope-toggle]');
  const count = await toggles.count();
  if (count > 0) {
    await toggles.first().click();
    await wait(1500);
    await takeSceneScreenshot(page, "18-scope-toggled");
    // Toggle back
    await toggles.first().click();
    await wait(1000);
  }

  console.log("[Scene: Scope] Done.");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const SCENES: Record<string, (page: Page) => Promise<void>> = {
  landing: sceneLanding,
  chat: sceneChat,
  stepup: sceneStepUp,
  observatory: sceneObservatory,
  debugger: sceneDebugger,
  scope: sceneScope,
};

async function main() {
  const scene = process.argv[2] ?? "all";

  console.log(`\n--- Agent Observatory Demo Recorder ---`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Scene:  ${scene}\n`);

  const browser: Browser = await chromium.launch({
    headless: false,
    slowMo: SLOW_MO,
  });

  const context: BrowserContext = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: {
      dir: OUTPUT_DIR,
      size: VIEWPORT,
    },
    // If you have auth cookies saved, load them:
    // storageState: join(__dirname, "auth-state.json"),
  });

  const page = await context.newPage();

  try {
    if (scene === "all") {
      for (const [name, fn] of Object.entries(SCENES)) {
        console.log(`\n=== Recording: ${name} ===`);
        await fn(page);
        await wait(1000);
      }
    } else if (SCENES[scene]) {
      await SCENES[scene](page);
    } else {
      console.error(`Unknown scene: ${scene}. Available: ${Object.keys(SCENES).join(", ")}, all`);
      process.exit(1);
    }
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  console.log(`\nRecordings saved to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
