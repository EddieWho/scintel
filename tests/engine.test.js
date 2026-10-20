import test from "node:test";
import assert from "node:assert/strict";

import { CASE } from "../src/case.js";
import {
  chooseHypothesis,
  createState,
  linkEvidence,
  markRead,
  recordAnalysis,
  restoreState,
  scoreCase,
  serializeState,
  setContainment,
  setText,
  startCase,
  submitDecision,
  takeAction,
} from "../src/engine.js";

const rationale =
  "批次异常跨越两家工厂，且采购与样品证据共同指向未经批准的来源。";

const started = (containment = "hold") =>
  setContainment(startCase(createState()), containment);

const conclude = (state, options = {}) => {
  let next = state;
  next = chooseHypothesis(next, options.hypothesis || "supplier");
  next = setText(next, "rationale", options.rationale || rationale);
  return submitDecision(
    next,
    options.decision || {
      response: "targeted",
      supplier: "suspend",
      inspection: "enhanced",
    },
  );
};

const read = (state, ...evidenceIds) =>
  evidenceIds.reduce((next, evidenceId) => markRead(next, evidenceId), state);

const reviewFixture = () => {
  let state = started("all");
  state = takeAction(state, "trace");
  state = takeAction(state, "audit");
  state = takeAction(state, "machine");
  state = takeAction(state, "lab");
  state = read(state, "E01", "E02", "E03", "E04", "E05", "E06");
  state = linkEvidence(state, "E04", "supplier", "supports");
  state = linkEvidence(state, "E05", "supplier", "supports");
  state = linkEvidence(state, "E05", "machine", "supports");
  state = linkEvidence(state, "E06", "supplier", "contradicts");
  return conclude(state);
};

test("案件数据与资源规则保持固定，行动不可重复", () => {
  assert.equal(CASE.id, "counterfeit-001");
  assert.equal(CASE.initialBudget, 100);
  assert.equal(CASE.initialHours, 12);
  assert.equal(
    CASE.evidence.find((item) => item.id === "E01").summary.includes("50"),
    true,
  );
  assert.equal(
    CASE.evidence.find((item) => item.id === "E01").summary.includes("61"),
    true,
  );

  let state = startCase(createState());
  assert.throws(() => takeAction(state, "trace"), /遏制/);
  state = setContainment(state, "monitor");
  state = takeAction(state, "trace");
  assert.equal(state.budget, 80);
  assert.equal(state.hoursLeft, 10);
  assert.deepEqual(state.unlocked, ["E01", "E02", "E03", "E04"]);
  assert.throws(() => takeAction(state, "trace"), /重复/);
});

test("先遏制与晚遏制的暴露量和结局不同", () => {
  const early = takeAction(started("hold"), "trace");
  let late = takeAction(started("monitor"), "trace");
  late = setContainment(late, "hold");

  assert.equal(early.exposure, 2);
  assert.equal(late.exposure, 16);
  assert.equal(early.containmentAt, 0);
  assert.equal(late.containmentAt, 2);
  const earlyResult = scoreCase(conclude(early));
  const lateResult = scoreCase(conclude(late));
  assert.ok(lateResult.categories[2].score < earlyResult.categories[2].score);
  assert.ok(lateResult.outcome.cost > earlyResult.outcome.cost);
  assert.ok(
    lateResult.outcome.leadTimeDays >= earlyResult.outcome.leadTimeDays,
  );
});

test("定向处置需要批次范围证据，全面处置只增加成本", () => {
  const unscoped = scoreCase(conclude(started("hold")));

  let hold = takeAction(started("hold"), "trace");
  hold = read(hold, "E03", "E04");
  const holdResult = scoreCase(conclude(hold));

  let all = takeAction(started("all"), "trace");
  all = read(all, "E03", "E04");
  const allResult = scoreCase(conclude(all));

  assert.equal(unscoped.outcome.customerRisk, "高");
  assert.equal(holdResult.outcome.customerRisk, "低");
  assert.equal(holdResult.categories[2].score, allResult.categories[2].score);
  assert.ok(allResult.outcome.cost > holdResult.outcome.cost);
});

test("证据必须先解锁和阅读，none 会移除链接", () => {
  let state = started();
  assert.throws(() => markRead(state, "E03"), /解锁/);
  state = markRead(state, "E01");
  state = linkEvidence(state, "E01", "supplier", "supports");
  assert.equal(state.links.length, 1);
  state = linkEvidence(state, "E01", "supplier", "none");
  assert.deepEqual(state.links, []);
  assert.throws(
    () => linkEvidence(state, "E01", "supplier", "unclear"),
    /关系/,
  );
});

test("空白理由不能提交，耗尽资源后仍可提交", () => {
  let state = started("all");
  state = takeAction(state, "lab");
  state = takeAction(state, "trace");
  state = takeAction(state, "audit");
  state = takeAction(state, "design");
  assert.equal(state.budget, 0);
  assert.equal(state.hoursLeft, 4);
  assert.throws(() => takeAction(state, "machine"), /预算不足/);
  state = chooseHypothesis(state, "machine");
  assert.throws(
    () =>
      submitDecision(state, {
        response: "targeted",
        supplier: "verify",
        inspection: "standard",
      }),
    /理由/,
  );

  state = setText(
    state,
    "rationale",
    "设备记录和控制批次应被优先解释，但仍需承担客户暴露风险。",
  );
  state = submitDecision(state, {
    response: "targeted",
    supplier: "verify",
    inspection: "standard",
  });
  assert.equal(state.decision.response, "targeted");
  assert.doesNotThrow(() => scoreCase(state));
});

test("提交后调查和证据编辑锁定，reflection 仍可更新", () => {
  let state = conclude(read(started(), "E01"));
  assert.throws(() => takeAction(state, "trace"), /锁定/);
  assert.throws(() => markRead(state, "E01"), /锁定/);
  assert.throws(
    () => linkEvidence(state, "E01", "supplier", "supports"),
    /锁定/,
  );
  assert.throws(
    () => setText(state, "rationale", "修改后的理由仍然不应被接受。"),
    /锁定/,
  );
  const reflected = setText(
    state,
    "reflection",
    "复盘：下次会先建立批次与箱号的交叉表。",
  );
  assert.equal(reflected.reflection.includes("复盘"), true);
  assert.equal(state.reflection, "");
});

test("把同一条证据刷给所有假设不会得到奖励", () => {
  let clean = conclude(read(started(), "E01"));
  let spam = read(started(), "E01");
  spam = linkEvidence(spam, "E01", "supplier", "supports");
  spam = linkEvidence(spam, "E01", "machine", "supports");
  spam = linkEvidence(spam, "E01", "design", "supports");
  spam = conclude(spam);
  assert.ok(scoreCase(spam).total < scoreCase(clean).total);
});

test("追溯加采购审核、或追溯加实验室，均可形成有力路径", () => {
  let traceAudit = takeAction(takeAction(started(), "trace"), "audit");
  traceAudit = read(traceAudit, "E01", "E03", "E04", "E05", "E06");
  for (const evidenceId of ["E03", "E04", "E05", "E06"]) {
    traceAudit = linkEvidence(traceAudit, evidenceId, "supplier", "supports");
  }
  traceAudit = conclude(traceAudit);

  let traceLab = takeAction(takeAction(started(), "trace"), "lab");
  traceLab = read(traceLab, "E01", "E03", "E04", "E08");
  for (const evidenceId of ["E03", "E04", "E08"]) {
    traceLab = linkEvidence(traceLab, evidenceId, "supplier", "supports");
  }
  traceLab = conclude(traceLab);

  const first = scoreCase(traceAudit);
  const second = scoreCase(traceLab);
  assert.ok(first.total >= 70, `追溯加审核分数过低：${first.total}`);
  assert.ok(second.total >= 65, `追溯加实验室分数过低：${second.total}`);
  assert.ok(
    first.categories.every((category) => category.score <= category.max),
  );
  assert.equal(first.truth, CASE.truth);
});

test("谨慎的证据支持优于只猜中供应商", () => {
  const lucky = conclude(started(), { hypothesis: "supplier" });
  let supported = takeAction(takeAction(started(), "trace"), "audit");
  supported = read(supported, "E01", "E03", "E04", "E05", "E06");
  for (const evidenceId of ["E03", "E04", "E05", "E06"]) {
    supported = linkEvidence(supported, evidenceId, "supplier", "supports");
  }
  supported = conclude(supported);
  assert.ok(scoreCase(supported).total > scoreCase(lucky).total);
});

test("序列化往返保留状态，恶意字段、资源、解锁和日志顺序会被拒绝", () => {
  let state = takeAction(started(), "trace");
  state = read(state, "E01", "E03");
  state = linkEvidence(state, "E03", "supplier", "supports");
  const roundTrip = restoreState(serializeState(state));
  assert.deepEqual(roundTrip, state);
  assert.equal(Object.isFrozen(roundTrip), true);

  assert.equal(restoreState("{"), null);
  const invalidBudget = JSON.parse(serializeState(state));
  invalidBudget.budget = -1;
  assert.equal(restoreState(JSON.stringify(invalidBudget)), null);
  const invalidUnlock = JSON.parse(serializeState(state));
  invalidUnlock.unlocked.push("E08");
  assert.equal(restoreState(JSON.stringify(invalidUnlock)), null);
  const forgedOrder = JSON.parse(serializeState(state));
  forgedOrder.log[2].time = 0;
  assert.equal(restoreState(JSON.stringify(forgedOrder)), null);
  const malformedDecision = JSON.parse(serializeState(state));
  malformedDecision.decision = { response: "targeted" };
  assert.equal(restoreState(JSON.stringify(malformedDecision)), null);
});

test("状态转换保持输入不变，CASE 与最终状态不可变", () => {
  const initial = createState();
  const startedState = startCase(initial);
  assert.equal(initial.started, false);
  assert.equal(Object.isFrozen(initial), true);
  assert.equal(Object.isFrozen(CASE), true);
  const contained = setContainment(startedState, "monitor");
  assert.equal(startedState.containment, null);
  assert.throws(() => recordAnalysis(contained, "timeline"), /追溯/);
  const traced = takeAction(contained, "trace");
  const analysed = recordAnalysis(traced, "timeline");
  assert.deepEqual(contained.analysisViews, []);
  const final = conclude(analysed);
  assert.equal(Object.isFrozen(final), true);
  assert.throws(() => setContainment(final, "hold"), /锁定/);
});

test("批次数据包含两个可比较的供应来源", () => {
  const suppliers = [...new Set(CASE.batches.map((batch) => batch.supplier))];
  assert.equal(suppliers.length, 2);
  assert.equal(suppliers.includes("恒川组件"), true);
  assert.equal(suppliers.includes("启源电子"), true);
  const table = CASE.evidence.find((item) => item.id === "E03").table;
  assert.equal(table.headers.includes("供应商"), true);
});

test("评分结果保持既有数值，解释字段不改变类别分数", () => {
  let state = takeAction(takeAction(started(), "trace"), "audit");
  state = read(state, "E01", "E03", "E04", "E05", "E06");
  for (const evidenceId of ["E03", "E04", "E05", "E06"]) {
    state = linkEvidence(state, evidenceId, "supplier", "supports");
  }
  const result = scoreCase(conclude(state));
  assert.equal(result.total, 89);
  assert.deepEqual(
    result.categories.map((category) => [
      category.id,
      category.score,
      category.max,
    ]),
    [
      ["evidence", 36, 40],
      ["hypothesis", 23, 30],
      ["decision", 30, 30],
    ],
  );
  assert.equal(result.categories[0].label, "证据运用");
  for (const category of result.categories) {
    assert.equal(typeof category.description, "string");
    assert.equal(typeof category.calculation, "string");
    assert.equal(typeof category.feedback, "string");
  }
  assert.equal(result.categories[0].feedback.includes("原始权重"), false);
  assert.equal(result.categories[0].feedback.includes("归一化"), false);
});

test("证据复核覆盖背景、未读、未链接、正确、混合和方向错误关系", () => {
  const result = scoreCase(reviewFixture());
  const review = result.evidenceReview;
  assert.deepEqual(review.summary, {
    readCount: 6,
    correctEvidenceCount: 2,
    incorrectLinkCount: 2,
    unlinkedReadCount: 1,
    unreadCount: 2,
  });
  assert.deepEqual(
    review.items.map((item) => [item.id, item.status]),
    [
      ["E01", "context"],
      ["E02", "context"],
      ["E03", "read"],
      ["E04", "used"],
      ["E05", "needs_review"],
      ["E06", "needs_review"],
      ["E07", "unread"],
      ["E08", "unread"],
    ],
  );
  assert.equal(
    review.items
      .find((item) => item.id === "E02")
      .explanation.includes("不能单独证明"),
    true,
  );
  assert.equal(
    review.items.find((item) => item.id === "E06").userLinks[0].correct,
    false,
  );
  assert.equal(
    review.items
      .find((item) => item.id === "E06")
      .userLinks[0].explanation.includes("支持"),
    true,
  );
  assert.equal(
    review.items
      .find((item) => item.id === "E07")
      .explanation.includes("尚未阅读"),
    true,
  );
  assert.equal(
    review.items.some((item) => item.id === "E09"),
    false,
  );
  assert.equal(
    review.items.some((item) => item.id === "E10"),
    false,
  );
});

test("证据条目的原始贡献按现有四分之一覆盖与错误关系扣分计算并可求和", () => {
  const result = scoreCase(reviewFixture());
  const raw = result.evidenceReview.items.reduce(
    (sum, item) => sum + item.rawContribution,
    0,
  );
  assert.equal(raw, 9.5);
  assert.equal(result.categories[0].score, 16);
});

test("已提交存档往返后评分与证据复核保持一致，未提交时仍拒绝评分", () => {
  const state = reviewFixture();
  const result = scoreCase(state);
  const restored = restoreState(serializeState(state));
  assert.deepEqual(scoreCase(restored), result);
  assert.throws(() => scoreCase(started()), /结论尚未提交/);
});

test("升级遏制的反馈同时说明首次暂停出货时间和最终措施", () => {
  let state = started("hold");
  state = setContainment(state, "all");
  state = takeAction(state, "trace");
  const feedback = scoreCase(conclude(state)).categories[2].feedback;
  assert.equal(feedback.includes("调查开始后 0 小时开始暂停出货"), true);
  assert.equal(feedback.includes("最终措施为“暂停全部型号出货”"), true);
});

test("选择被正确反驳的主假设时，反馈明确指出反驳关系", () => {
  let state = takeAction(started(), "machine");
  state = read(state, "E07");
  state = linkEvidence(state, "E07", "machine", "contradicts");
  const feedback = scoreCase(conclude(state, { hypothesis: "machine" }))
    .categories[1].feedback;
  assert.equal(feedback.includes("1 条正确反驳关系"), true);
  assert.equal(
    feedback.includes("这些证据在反驳你最终选择的假设，需要重新考虑结论"),
    true,
  );
});
