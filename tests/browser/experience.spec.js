import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  createState,
  startCase,
  setContainment,
  takeAction,
  markRead,
  linkEvidence,
  chooseHypothesis,
  setText,
  submitDecision,
  serializeState,
} from "../../src/engine.js";

async function nav(page, route) {
  if (
    (await page.locator('[data-action="menu"]').isVisible()) &&
    !(await page.locator(".sidebar").isVisible())
  )
    await page.locator('[data-action="menu"]').click();
  await page.locator(`nav [data-route="${route}"]`).click();
}
async function start(page) {
  await page.goto("./");
  await page.locator('[data-action="start"]').click();
  await page.locator('[data-action="contain"][data-id="hold"]').click();
}
async function investigate(page, id) {
  await nav(page, "investigate");
  await page.locator(`[data-action="investigate"][data-id="${id}"]`).click();
  await page.locator('#confirm-dialog [data-action="confirm"]').click();
}
async function actionMaterials(page, id) {
  await page
    .locator(`.action-card [data-action="action-evidence"][data-id="${id}"]`)
    .click();
}

test("each investigation opens its own highlighted materials, ignoring stale filters and retaining context on reload/back", async ({
  page,
}, testInfo) => {
  await start(page);
  await nav(page, "evidence");
  await page.locator("#evidence-search").fill("不存在的标题");
  await page.locator("#evidence-filter").selectOption("locked");
  await investigate(page, "trace");
  await expect(page.locator(".investigation-result")).toContainText("E03、E04");
  await actionMaterials(page, "trace");
  await expect(page).toHaveURL(/#evidence\?from=trace$/);
  await expect(page.locator("#evidence-search")).toHaveValue("");
  await expect(page.locator("#evidence-filter")).toHaveValue("all");
  await expect(page.locator(".evidence-card.is-highlighted")).toHaveCount(2);
  await expect(page.locator('[data-evidence-id="E03"]')).toContainText(
    "本次新增 · 未读",
  );
  await expect(page.locator('[data-evidence-id="E04"]')).toContainText(
    "本次新增 · 未读",
  );
  await expect(page.locator('[data-evidence-id="E01"]')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("focused-materials-desktop.png"),
    fullPage: true,
  });
  await page.locator('[data-action="open-evidence"][data-id="E03"]').click();
  await page.locator('[data-action="next-evidence"][data-id="E04"]').click();
  await expect(page.locator("#evidence-dialog")).toContainText(
    "本次调查材料已全部阅读",
  );
  await page.getByRole("button", { name: "关闭证据", exact: true }).click();
  await expect(page.locator("#evidence-context")).toContainText("已全部阅读");
  await page.reload();
  await expect(page.locator(".evidence-card.is-highlighted")).toHaveCount(2);
  await expect(page.locator("#evidence-grid")).not.toContainText("本次新增");
  await investigate(page, "audit");
  await actionMaterials(page, "audit");
  await expect(page.locator('[data-evidence-id="E05"]')).toContainText(
    "本次新增",
  );
  await expect(page.locator('[data-evidence-id="E06"]')).toContainText(
    "本次新增",
  );
  await nav(page, "investigate");
  await actionMaterials(page, "trace");
  await expect(page.locator('[data-evidence-id="E03"]')).toContainText(
    "已阅读",
  );
  await expect(page.locator('[data-evidence-id="E05"]')).toHaveCount(0);
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/#evidence\?from=audit$/);
  await expect(
    page.locator('[data-evidence-id="E05"].is-highlighted'),
  ).toBeVisible();
  await page.locator('[data-action="all-evidence"]').click();
  await expect(page.locator(".evidence-card")).toHaveCount(10);
  await expect(page.locator(".is-highlighted")).toHaveCount(0);
});

test("mobile reader carries the current document into hypothesis linking and keeps form choices after saving", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await nav(page, "evidence");
  await page.locator('[data-action="open-evidence"][data-id="E01"]').click();
  await page.getByRole("button", { name: "关闭证据", exact: true }).click();
  await investigate(page, "trace");
  await actionMaterials(page, "trace");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("focused-materials-mobile.png"),
    fullPage: true,
  });
  await page.locator('[data-action="open-evidence"][data-id="E03"]').click();
  await page.locator('[data-action="next-evidence"][data-id="E04"]').click();
  await page.locator('[data-action="evidence-to-hypotheses"]').click();
  await expect(page).toHaveURL(/#hypotheses$/);
  await expect(page.locator('#link-form [name="evidence"]')).toHaveValue("E04");
  await expect(page.locator('#link-form [name="evidence"]')).toBeFocused();
  await page.locator('#link-form [name="hypothesis"]').selectOption("supplier");
  await page.locator('#link-form button[type="submit"]').click();
  await expect(page.locator('#link-form [name="evidence"]')).toHaveValue("E04");
  await expect(page.locator(".linked-item")).toContainText("E04");
  await expect(page.locator(".evidence-review")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("a completed v1 save shows readable score feedback and per-evidence review in the page and download", async ({
  page,
}, testInfo) => {
  let state = setContainment(startCase(createState()), "hold");
  state = takeAction(state, "trace");
  for (const id of ["E01", "E03", "E04"]) state = markRead(state, id);
  state = linkEvidence(state, "E03", "supplier", "supports");
  state = linkEvidence(state, "E04", "supplier", "contradicts");
  state = chooseHypothesis(state, "supplier");
  state = setText(
    state,
    "rationale",
    "异常出现在不同工厂的特定批次，仍需要核验供应来源，因此先暂停出货并限定召回范围。",
  );
  state = submitDecision(state, {
    response: "targeted",
    supplier: "verify",
    inspection: "enhanced",
  });
  await page.goto("./");
  await page.evaluate(
    (saved) => localStorage.setItem("scintel:counterfeit:1", saved),
    serializeState(state),
  );
  await page.goto("./#report");
  await page.reload();
  const card = page.locator('[data-score-category="evidence"]');
  await expect(
    card.getByRole("heading", { name: "证据运用", exact: true }),
  ).toBeVisible();
  expect(await card.innerText()).not.toContain("归一化");
  await expect(card.locator(".score-calculation p")).toBeHidden();
  await expect(page.locator('[data-review-evidence="E01"]')).toHaveClass(
    /context/,
  );
  await expect(page.locator('[data-review-evidence="E02"]')).toHaveClass(
    /unread/,
  );
  await expect(page.locator('[data-review-evidence="E03"]')).toHaveClass(
    /used/,
  );
  await expect(page.locator('[data-review-evidence="E04"]')).toHaveClass(
    /needs_review/,
  );
  await expect(
    page.locator('[data-review-evidence="E04"] .review-relations'),
  ).toHaveAttribute("open", "");
  await expect(page.locator('[data-review-evidence="E05"]')).toHaveCount(0);
  await card.locator("summary").click();
  await expect(card.locator(".score-calculation p")).toBeVisible();
  await card.locator("summary").click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-action="export-report"]').click();
  const report = await readFile(await (await downloadPromise).path(), "utf8");
  expect(report).toContain("证据运用明细");
  expect(report).toContain("你记录的关系");
  expect(report).not.toContain("证据整理");
  await page.screenshot({
    path: testInfo.outputPath("score-feedback-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("score-feedback-mobile.png"),
    fullPage: true,
  });
});

test("unfinished evidence work is explained before submission without blocking a decision", async ({
  page,
}) => {
  await start(page);
  await nav(page, "hypotheses");
  await page
    .locator('[data-action="choose-hypothesis"][data-id="supplier"]')
    .click();
  await nav(page, "decision");
  await expect(page.locator(".decision-checklist")).toContainText(
    "2 份已获取材料未读",
  );
  await expect(page.locator(".decision-checklist")).toContainText(
    "尚未记录证据与假设的关系",
  );
  await page
    .locator("#rationale")
    .fill(
      "当前证据仍不充分，但客户安全风险需要先处理，因此先暂停销售并开展来源核验。",
    );
  await page.locator('#decision-form button[type="submit"]').click();
  await expect(
    page.locator("#confirm-dialog .decision-checklist"),
  ).toBeVisible();
  await page.locator('#confirm-dialog [data-action="confirm"]').click();
  await expect(page.locator(".evidence-review")).toBeVisible();
});
