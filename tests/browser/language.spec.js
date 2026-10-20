import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as engine from "../../src/engine.js";

const STORAGE = "scintel:counterfeit:1";
const rationale =
  '我保留中文决策理由，结合证据运用和批次信息判断风险；保留原文 <script>alert("x")</script>。';
async function nav(page, route) {
  if (
    (await page.locator("[data-action=menu]").isVisible()) &&
    !(await page.locator(".sidebar").isVisible())
  )
    await page.locator("[data-action=menu]").click();
  await page.locator(`nav [data-route=${route}]`).click();
  await expect(page.locator(`nav [data-route=${route}]`)).toHaveAttribute(
    "aria-current",
    "page",
  );
}
async function assertEnglish(page) {
  const remaining = await page.evaluate(() => {
    const result = [];
    const skip = (element) =>
      element.closest(
        "[data-user-content], [data-no-i18n], textarea, script, style, noscript, dialog:not([open])",
      );
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      const node = walker.currentNode,
        parent = node.parentElement;
      if (
        parent &&
        !skip(parent) &&
        parent.getClientRects().length &&
        /\p{Script=Han}/u.test(node.textContent)
      )
        result.push(node.textContent.trim());
    }
    for (const element of document.querySelectorAll(
      "[aria-label],[placeholder],[title]",
    )) {
      if (
        element.closest(
          "[data-no-i18n], [data-user-content], dialog:not([open])",
        ) ||
        !element.getClientRects().length
      )
        continue;
      for (const attribute of ["aria-label", "placeholder", "title"]) {
        const value = element.getAttribute(attribute);
        if (value && /\p{Script=Han}/u.test(value))
          result.push(`${attribute}: ${value}`);
      }
    }
    return [...new Set(result)];
  });
  expect(remaining).toEqual([]);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}
function progressFixture() {
  let state = engine.setContainment(
    engine.startCase(engine.createState()),
    "hold",
  );
  for (const id of ["trace", "audit", "machine", "design"])
    state = engine.takeAction(state, id);
  for (const id of state.unlocked) state = engine.markRead(state, id);
  for (const id of ["E03", "E04", "E05", "E06"])
    state = engine.linkEvidence(state, id, "supplier", "supports");
  state = engine.linkEvidence(state, "E07", "machine", "contradicts");
  state = engine.linkEvidence(state, "E09", "design", "contradicts");
  state = engine.chooseHypothesis(state, "supplier");
  return state;
}

test("language switches inside a live confirmation and reader without losing progress or batch context", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.locator("[data-action=start]").click();
  await page.locator("[data-action=contain][data-id=hold]").click();
  await nav(page, "investigate");
  await page.locator("[data-action=investigate][data-id=trace]").click();
  await page.locator("#confirm-dialog [data-language]").selectOption("en");
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await assertEnglish(page);
  await page.locator("#confirm-dialog [data-action=confirm]").click();
  await page
    .locator(".action-card [data-action=action-evidence][data-id=trace]")
    .click();
  await page.locator("[data-action=open-evidence][data-id=E03]").click();
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    STORAGE,
  );
  await page.locator("#evidence-dialog [data-language]").selectOption("zh-CN");
  await expect(page.locator("#evidence-title")).toHaveText("批次质量抽样表");
  await expect(page.locator("#evidence-dialog")).toBeVisible();
  await page.locator("#evidence-dialog [data-language]").selectOption("en");
  await expect(page.locator("#evidence-title")).toHaveText(
    "Batch quality sampling table",
  );
  await assertEnglish(page);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE)).toBe(
    before,
  );
  await page
    .locator("#evidence-dialog .dialog-top [data-action=close-evidence]")
    .click();
  await page.reload();
  await expect(page.locator("header [data-language]")).toHaveValue("en");
  await expect(page).toHaveURL(/#evidence\?from=trace$/);
  await expect(page.locator(".is-highlighted")).toHaveCount(2);
  await page.locator("#evidence-search").fill("Batch quality");
  await expect(page.locator(".evidence-card")).toHaveCount(1);
  await page.locator("header [data-language]").selectOption("zh-CN");
  await expect(page.locator("#evidence-search")).toHaveValue("Batch quality");
  await expect(page.locator(".evidence-card")).toHaveCount(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE)).toBe(
    before,
  );
});

test("forms, filters, scores, and user writing survive language changes; reports use the selected language", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await page.evaluate(({ key, saved }) => localStorage.setItem(key, saved), {
    key: STORAGE,
    saved: engine.serializeState(progressFixture()),
  });
  await page.goto("./#decision");
  await page.reload();
  await page.locator("#rationale").fill(rationale);
  await page.locator("input[name=supplier][value=verify]").check();
  await page.locator("header [data-language]").selectOption("en");
  await expect(page.locator("#rationale")).toHaveValue(rationale);
  await expect(
    page.locator("input[name=supplier][value=verify]"),
  ).toBeChecked();
  await assertEnglish(page);
  await nav(page, "analytics");
  await page.locator("#analysis-group").selectOption("id");
  await page.locator("#analysis-supplier").selectOption("启源电子");
  await page.locator("#analysis-factory").selectOption("东一厂");
  await page.locator("[data-action=record-analysis]").click();
  await page.locator("header [data-language]").selectOption("zh-CN");
  await expect(page.locator("#analysis-supplier")).toHaveValue("启源电子");
  await expect(page.locator("#analysis-factory")).toHaveValue("东一厂");
  await page.locator("[data-action=record-analysis]").click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).analysisViews.length,
      STORAGE,
    ),
  ).toBe(1);
  await page.locator("header [data-language]").selectOption("en");
  await assertEnglish(page);
  for (const route of [
    "overview",
    "investigate",
    "evidence",
    "hypotheses",
    "decision",
  ]) {
    await nav(page, route);
    await assertEnglish(page);
  }
  await page.locator("#decision-form button[type=submit]").click();
  await page.locator("#confirm-dialog [data-action=confirm]").click();
  await page.locator(".evidence-review").waitFor();
  await expect(page.locator("[data-score-category=evidence] h2")).toHaveText(
    "Evidence use",
  );
  await expect(page.locator(".submitted-rationale")).toHaveText(rationale);
  await page.locator("#reflection").fill("尚未填写");
  await assertEnglish(page);
  const total = await page.locator(".score-ring strong").innerText();
  await page.locator("header [data-language]").selectOption("zh-CN");
  await expect(page.locator("#reflection")).toHaveValue("尚未填写");
  await expect(page.locator(".score-ring strong")).toHaveText(total);
  await page.locator("header [data-language]").selectOption("en");
  const reportPromise = page.waitForEvent("download");
  await page.locator("[data-action=export-report]").click();
  const downloaded = await reportPromise;
  expect(downloaded.suggestedFilename()).toBe(
    "SCINTEL-investigation-report.html",
  );
  const report = await readFile(await downloaded.path(), "utf8");
  expect(report).toContain('<html lang="en">');
  expect(report).toContain("Evidence use");
  expect(report).toContain("尚未填写");
  expect(report).toContain("&lt;script&gt;");
  const reportHan = await page.evaluate((html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc
      .querySelectorAll("[data-user-content],style")
      .forEach((el) => el.remove());
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const remaining = [];
    while (walker.nextNode())
      if (/\p{Script=Han}/u.test(walker.currentNode.textContent))
        remaining.push(walker.currentNode.textContent.trim());
    return remaining;
  }, report);
  expect(reportHan).toEqual([]);
  const jsonPromise = page.waitForEvent("download");
  await page.locator("[data-action=export-json]").click();
  const exported = JSON.parse(
    await readFile(await (await jsonPromise).path(), "utf8"),
  );
  expect(exported.language).toBe("en");
  expect(exported.state.rationale).toBe(rationale);
  expect(exported.assessment.categories[0].label).toBe("Evidence use");
  expect(exported.displayLog[0].message).toBe("Case started");
  await page.screenshot({
    path: testInfo.outputPath("english-report.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#reflection")).toHaveValue("尚未填写");
  await expect(page.locator(".score-ring strong")).toHaveText(total);
});

test("language selection works when persistence is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("denied");
      },
    }),
  );
  await page.goto("./");
  await page.locator("header [data-language]").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#toast")).toContainText("Language changed");
  await expect(page.locator("[data-action=start]")).toBeVisible();
  await page.locator("[data-action=start]").click();
  await expect(page.locator(".notice.warning")).toContainText("Local storage");
  await page.locator("header [data-language]").selectOption("zh-CN");
  await expect(page.locator(".containment")).toBeVisible();
});

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
]) {
  test(`English layout at ${viewport.width}px covers empty screens, help, and readable evidence`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("./");
    await page.locator("header [data-language]").selectOption("en");
    await assertEnglish(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("english-overview.png"),
      fullPage: true,
    });
    for (const route of [
      "investigate",
      "analytics",
      "hypotheses",
      "decision",
      "report",
    ]) {
      await nav(page, route);
      await assertEnglish(page);
    }
    await nav(page, "evidence");
    await page.locator("[data-action=open-evidence][data-id=E01]").click();
    await assertEnglish(page);
    expect(
      await page
        .locator("#evidence-dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page
      .locator("#evidence-dialog .dialog-top [data-action=close-evidence]")
      .click();
    await page.locator("[data-action=help]").click();
    await assertEnglish(page);
    await page.locator("#confirm-dialog [data-action=confirm]").click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
