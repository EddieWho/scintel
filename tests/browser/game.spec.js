import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const rationale =
  "批次追踪显示异常跨越工厂，实验室与设备控制样品支持来源异常，因此召回相关批次并暂停涉事供应，同时加强真实性检验。";
async function nav(page, route) {
  const menu = page.locator('[data-action="menu"]');
  if ((await menu.isVisible()) && !(await page.locator(".sidebar").isVisible()))
    await menu.click();
  await page.locator(`nav [data-route="${route}"]`).click();
}
async function start(page, containment = "hold") {
  await page.goto("./");
  await page.locator('[data-action="start"]').click();
  await page
    .locator(`[data-action="contain"][data-id="${containment}"]`)
    .click();
}
async function investigate(page, action) {
  await nav(page, "investigate");
  await page
    .locator(`[data-action="investigate"][data-id="${action}"]`)
    .click();
  await page.locator('#confirm-dialog [data-action="confirm"]').click();
}
async function readEvidence(page, ids) {
  await nav(page, "evidence");
  for (const id of ids) {
    await page
      .locator(`[data-action="open-evidence"][data-id="${id}"]`)
      .click();
    await expect(page.locator("#evidence-dialog")).toBeVisible();
    await page.locator('[data-action="close-evidence"]').click();
  }
}
async function link(page, evidence, hypothesis, relation) {
  await page.locator('#link-form [name="evidence"]').selectOption(evidence);
  await page.locator('#link-form [name="hypothesis"]').selectOption(hypothesis);
  await page.locator('#link-form [name="relation"]').selectOption(relation);
  await page.locator('#link-form button[type="submit"]').click();
}
async function finalize(page) {
  await nav(page, "decision");
  await page.locator("#rationale").fill(rationale);
  await page.locator('input[name="supplier"][value="suspend"]').check();
  await page.locator('#decision-form button[type="submit"]').click();
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await page.locator('#confirm-dialog [data-action="confirm"]').click();
  await expect(page).toHaveURL(/#report$/);
}

test("complete a supported investigation, restore progress, export and lock final decision", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  for (const action of ["trace", "lab", "machine", "design"])
    await investigate(page, action);
  await readEvidence(page, ["E01", "E02", "E03", "E04", "E07", "E08", "E09"]);
  await nav(page, "analytics");
  await expect(page.locator(".bar-chart")).toBeVisible();
  await page.locator("#analysis-group").selectOption("factory");
  await page.locator('[data-action="record-analysis"]').click();
  await page.locator("#analysis-group").selectOption("id");
  await page.locator('[data-action="record-analysis"]').click();
  await nav(page, "hypotheses");
  for (const id of ["E03", "E04", "E08"])
    await link(page, id, "supplier", "supports");
  await link(page, "E07", "machine", "contradicts");
  await link(page, "E09", "design", "contradicts");
  await page
    .locator('[data-action="choose-hypothesis"][data-id="supplier"]')
    .click();
  await page.reload();
  await expect(page.locator(".hypothesis-card.chosen")).toHaveCount(1);
  await expect(page.locator(".linked-item")).toHaveCount(5);
  await finalize(page);
  const total = Number(
    (await page.locator(".score-ring strong").innerText()).split("/")[0],
  );
  expect(total).toBeGreaterThanOrEqual(80);
  await page
    .locator("#reflection")
    .fill('下一次会先验证替代解释。<script>alert("x")</script>');
  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-action="export-report"]').click();
  const download = await downloadPromise;
  const report = await readFile(await download.path(), "utf8");
  expect(report).toContain("假设矩阵");
  expect(report).toContain(rationale);
  expect(report).toContain("&lt;script&gt;");
  expect(report).not.toContain("<script>alert");
  expect(report).toContain("E08");
  await page.screenshot({
    path: testInfo.outputPath("report-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("report-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.reload();
  await expect(page.locator("#reflection")).toHaveValue(/下一次会先验证/);
  await nav(page, "hypotheses");
  await expect(
    page.locator('[data-action="choose-hypothesis"]').first(),
  ).toBeDisabled();
  await nav(page, "investigate");
  await expect(page.locator('[data-action="investigate"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("required steps, failed submission, evidence filters and cancelled reset preserve progress", async ({
  page,
}) => {
  await page.goto("./");
  await nav(page, "report");
  await expect(
    page.getByRole("heading", { name: "调查仍在进行" }),
  ).toBeVisible();
  await nav(page, "overview");
  await page.locator('[data-action="start"]').click();
  await nav(page, "investigate");
  await expect(
    page.locator('[data-action="investigate"]').first(),
  ).toBeDisabled();
  await page.locator('[data-action="contain"][data-id="monitor"]').click();
  await investigate(page, "trace");
  await readEvidence(page, ["E03"]);
  await nav(page, "evidence");
  await page.locator("#evidence-search").fill("E03");
  await expect(page.locator(".evidence-card")).toHaveCount(1);
  await page.locator("#evidence-search").fill("nothing-matches");
  await expect(page.getByText("没有符合条件的材料。")).toBeVisible();
  await nav(page, "decision");
  await page.locator('#decision-form button[type="submit"]').click();
  await expect(page.locator("#toast")).toContainText("请先");
  await nav(page, "hypotheses");
  await page
    .locator('[data-action="choose-hypothesis"][data-id="supplier"]')
    .click();
  await nav(page, "decision");
  await page.locator("#rationale").fill("太短");
  await page.locator('#decision-form button[type="submit"]').click();
  await expect(page.locator("#toast")).toContainText("20");
  await page.locator('[data-action="restart"]').click();
  await page
    .locator('#confirm-dialog [data-action="cancel-confirm"]')
    .last()
    .click();
  await page.reload();
  await expect(page.locator("#rationale")).toHaveValue("太短");
  await page.locator('[data-action="restart"]').click();
  await page.locator('#confirm-dialog [data-action="confirm"]').click();
  await expect(page.locator('[data-action="start"]')).toBeVisible();
});

test("resource exhaustion still allows a final decision", async ({ page }) => {
  await start(page, "all");
  for (const action of ["trace", "audit", "lab", "design"])
    await investigate(page, action);
  await expect(
    page.locator('[data-action="investigate"][data-id="machine"]'),
  ).toBeDisabled();
  await nav(page, "hypotheses");
  await page
    .locator('[data-action="choose-hypothesis"][data-id="supplier"]')
    .click();
  await finalize(page);
  await expect(page.locator(".score-ring")).toBeVisible();
});

test("storage denial and corrupt saves recover without a blank page", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("denied");
      },
    });
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4175/scintel/");
  await expect(page.locator('[data-action="start"]')).toBeVisible();
  await page.locator('[data-action="start"]').click();
  await expect(page.locator(".notice.warning")).toContainText("存储不可用");
  await page.locator('[data-action="contain"][data-id="hold"]').click();
  await context.close();
  const clean = await browser.newPage();
  await clean.goto("http://127.0.0.1:4175/scintel/");
  await clean.evaluate(() =>
    localStorage.setItem("scintel:counterfeit:1", '{"broken":true}'),
  );
  await clean.reload();
  await expect(clean.locator('[data-action="start"]')).toBeVisible();
  await expect(clean.locator(".notice.warning")).toContainText("旧存档");
  await clean.close();
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name}: responsive layout and evidence dialog`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("./");
    await expect(
      page.getByRole("heading", { name: "警报背后的真相" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`overview-${viewport.name}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await nav(page, "evidence");
    await page.locator('[data-action="open-evidence"][data-id="E01"]').click();
    await expect(page.locator("#evidence-dialog")).toBeVisible();
    expect(
      await page
        .locator("#evidence-dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator("#evidence-dialog")).not.toBeVisible();
    await nav(page, "overview");
    await page.locator('[data-action="start"]').click();
    await page.locator('[data-action="contain"][data-id="hold"]').click();
    await investigate(page, "trace");
    await nav(page, "analytics");
    await page.locator("#analysis-group").selectOption("id");
    await expect(page.locator(".chart-row")).toHaveCount(6);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`analysis-${viewport.name}.png`),
      fullPage: true,
    });
  });
}
