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
