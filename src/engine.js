import { CASE } from "./case.js";

const STATE_KEYS = [
  "version",
  "caseId",
  "started",
  "budget",
  "hoursLeft",
  "actions",
  "unlocked",
  "read",
  "links",
  "hypothesis",
  "containment",
  "containmentAt",
  "exposure",
  "analysisViews",
  "rationale",
  "reflection",
  "decision",
  "log",
];

const HYPOTHESES = new Map(CASE.hypotheses.map((item) => [item.id, item]));
const CONTAINMENT = new Map(
  CASE.containmentOptions.map((item) => [item.id, item]),
);
const INVESTIGATIONS = new Map(
  CASE.investigations.map((item) => [item.id, item]),
);
const EVIDENCE = new Map(CASE.evidence.map((item) => [item.id, item]));
const CORRECT_LINKS = new Map(
  CASE.correctLinks.map((link) => [
    `${link.evidenceId}|${link.hypothesisId}`,
    link,
  ]),
);
const EVIDENCE_WEIGHTS = Object.freeze({
  E01: 2,
  E02: 1,
  E03: 5,
  E04: 6,
  E05: 4,
  E06: 6,
  E07: 4,
  E08: 8,
  E09: 3,
  E10: 1,
});
const RELATIONS = new Set(["supports", "contradicts"]);
const DECISION_VALUES = Object.freeze({
  response: new Set(["targeted", "all", "none"]),
  supplier: new Set(["suspend", "verify", "keep"]),
  inspection: new Set(["enhanced", "standard"]),
});

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
};

const isObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasExactKeys = (value, keys) => {
  if (!isObject(value)) return false;
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  return (
    expected.length === actual.length &&
    expected.every((key, index) => key === actual[index])
  );
};

const integer = (value) => Number.isSafeInteger(value);
const knownEvidence = (id) => typeof id === "string" && EVIDENCE.has(id);
const knownHypothesis = (id) => typeof id === "string" && HYPOTHESES.has(id);

const cloneState = (state) => ({
  ...state,
  actions: [...state.actions],
  unlocked: [...state.unlocked],
  read: [...state.read],
  links: state.links.map((link) => ({ ...link })),
  analysisViews: [...state.analysisViews],
  decision: state.decision ? { ...state.decision } : null,
  log: state.log.map((entry) => ({ ...entry })),
});

const validDecision = (decision) =>
  isObject(decision) &&
  hasExactKeys(decision, ["response", "supplier", "inspection"]) &&
  Object.entries(DECISION_VALUES).every(
    ([field, values]) =>
      typeof decision[field] === "string" && values.has(decision[field]),
  );

/*
 * Logs are intentionally small and structured by their Chinese message. They
 * are still user-facing, while also giving restoreState enough information to
 * verify action order, containment upgrades, elapsed time, and exposure.
 */
const parseLogEvent = (message) => {
  if (message === "案件开始") return { kind: "start" };
  if (message === "提交决策") return { kind: "submit" };
  if (message.startsWith("遏制：")) {
    const title = message.slice(3);
    const option = CASE.containmentOptions.find((item) => item.title === title);
    return option ? { kind: "containment", id: option.id } : null;
  }
  if (message.startsWith("调查：")) {
    const title = message.slice(3);
    const action = CASE.investigations.find((item) => item.title === title);
    return action ? { kind: "action", id: action.id } : null;
  }
  return null;
};

const validateState = (state) => {
  if (!hasExactKeys(state, STATE_KEYS)) return false;
  if (state.version !== CASE.version || state.caseId !== CASE.id) return false;
  if (typeof state.started !== "boolean") return false;
  if (
    !integer(state.budget) ||
    state.budget < 0 ||
    state.budget > CASE.initialBudget
  )
    return false;
  if (
    !integer(state.hoursLeft) ||
    state.hoursLeft < 0 ||
    state.hoursLeft > CASE.initialHours
  )
    return false;
  if (!integer(state.exposure) || state.exposure < 0) return false;
  if (
    !Array.isArray(state.actions) ||
    !Array.isArray(state.unlocked) ||
    !Array.isArray(state.read)
  )
    return false;
  if (
    !Array.isArray(state.links) ||
    !Array.isArray(state.analysisViews) ||
    !Array.isArray(state.log)
  )
    return false;
  if (!(state.hypothesis === null || knownHypothesis(state.hypothesis)))
    return false;
  if (!(state.containment === null || CONTAINMENT.has(state.containment)))
    return false;
  if (
    !(
      state.containmentAt === null ||
      (integer(state.containmentAt) &&
        state.containmentAt >= 0 &&
        state.containmentAt <= CASE.initialHours)
    )
  )
    return false;
  if (
    typeof state.rationale !== "string" ||
    typeof state.reflection !== "string"
  )
    return false;

  const seenActions = new Set();
  let actionCost = 0;
  let actionHours = 0;
  for (const actionId of state.actions) {
    if (
      typeof actionId !== "string" ||
      !INVESTIGATIONS.has(actionId) ||
      seenActions.has(actionId)
    )
      return false;
    seenActions.add(actionId);
    const action = INVESTIGATIONS.get(actionId);
    actionCost += action.cost;
    actionHours += action.hours;
  }
  if (
    actionCost +
      (state.containment ? CONTAINMENT.get(state.containment).cost : 0) !==
    CASE.initialBudget - state.budget
  )
    return false;
  if (actionHours !== CASE.initialHours - state.hoursLeft) return false;

  const expectedUnlocked = CASE.evidence
    .filter((item) => item.initial)
    .map((item) => item.id);
  for (const actionId of state.actions) {
    for (const evidenceId of INVESTIGATIONS.get(actionId).evidenceIds) {
      if (!expectedUnlocked.includes(evidenceId))
        expectedUnlocked.push(evidenceId);
    }
  }
  if (
    state.unlocked.length !== expectedUnlocked.length ||
    state.unlocked.some((id, index) => id !== expectedUnlocked[index])
  )
    return false;
  if (state.unlocked.some((id) => !knownEvidence(id))) return false;

  const readSet = new Set();
  for (const evidenceId of state.read) {
    if (
      !knownEvidence(evidenceId) ||
      readSet.has(evidenceId) ||
      !state.unlocked.includes(evidenceId)
    )
      return false;
    readSet.add(evidenceId);
  }

  const linkPairs = new Set();
  for (const link of state.links) {
    if (!hasExactKeys(link, ["evidenceId", "hypothesisId", "relation"]))
      return false;
    if (
      !knownEvidence(link.evidenceId) ||
      !knownHypothesis(link.hypothesisId) ||
      !RELATIONS.has(link.relation)
    )
      return false;
    if (!readSet.has(link.evidenceId)) return false;
    const pair = `${link.evidenceId}|${link.hypothesisId}`;
    if (linkPairs.has(pair)) return false;
    linkPairs.add(pair);
  }

  const analysisSet = new Set();
  for (const key of state.analysisViews) {
    if (
      typeof key !== "string" ||
      key.trim().length === 0 ||
      analysisSet.has(key)
    )
      return false;
    analysisSet.add(key);
  }

  if (state.decision !== null && !validDecision(state.decision)) return false;

  let expectedExposure = 0;
  let elapsed = 0;
  let currentContainment = null;
  let containmentAt = null;
  const logActions = [];
  let submitCount = 0;
  let sawStart = false;
  let previousTime = -1;
  for (let index = 0; index < state.log.length; index += 1) {
    const entry = state.log[index];
    if (
      !hasExactKeys(entry, ["time", "message"]) ||
      !integer(entry.time) ||
      entry.time < 0 ||
      entry.time > CASE.initialHours ||
      typeof entry.message !== "string"
    )
      return false;
    if (entry.time < previousTime) return false;
    previousTime = entry.time;
    const event = parseLogEvent(entry.message);
    if (!event) return false;
    if (event.kind === "start") {
      if (!state.started || index !== 0 || sawStart || entry.time !== 0)
        return false;
      sawStart = true;
      continue;
    }
    if (!state.started || !sawStart) return false;
    if (event.kind === "containment") {
      if (!CONTAINMENT.has(event.id)) return false;
      const option = CONTAINMENT.get(event.id);
      if (
        currentContainment !== null &&
        option.level <= CONTAINMENT.get(currentContainment).level
      )
        return false;
      if (entry.time !== elapsed) return false;
      if (option.level >= 1 && containmentAt === null) containmentAt = elapsed;
      currentContainment = event.id;
      continue;
    }
    if (event.kind === "action") {
      if (!INVESTIGATIONS.has(event.id) || currentContainment === null)
        return false;
      const action = INVESTIGATIONS.get(event.id);
      elapsed += action.hours;
      if (entry.time !== elapsed || logActions.includes(event.id)) return false;
      logActions.push(event.id);
      expectedExposure +=
        action.hours *
        (CONTAINMENT.get(currentContainment).level === 0 ? 8 : 1);
      continue;
    }
    if (event.kind === "submit") {
      if (
        submitCount > 0 ||
        index !== state.log.length - 1 ||
        entry.time !== elapsed
      )
        return false;
      submitCount += 1;
    }
  }

  if (state.started !== sawStart) return false;
  if (!state.started && state.log.length !== 0) return false;
  if (
    logActions.length !== state.actions.length ||
    logActions.some((id, index) => id !== state.actions[index])
  )
    return false;
  if (
    currentContainment !== state.containment ||
    containmentAt !== state.containmentAt
  )
    return false;
  if (expectedExposure !== state.exposure) return false;
  if (
    state.started &&
    state.log.length > 0 &&
    elapsed !== CASE.initialHours - state.hoursLeft
  )
    return false;
  if (state.decision === null) {
    if (submitCount !== 0) return false;
  } else {
    if (
      !state.started ||
      state.containment === null ||
      state.hypothesis === null ||
      state.rationale.trim().length < 20 ||
      submitCount !== 1
    )
      return false;
  }
  if (state.analysisViews.length > 0 && !state.actions.includes("trace"))
    return false;
  if (
    !state.started &&
    (state.actions.length > 0 ||
      state.containment !== null ||
      state.containmentAt !== null ||
      state.exposure !== 0 ||
      state.decision !== null)
  )
    return false;
  return true;
};

const ensureState = (state) => {
  if (!validateState(state)) throw new Error("状态无效或与案件版本不兼容");
  return state;
};

const finishState = (state) => {
  if (!validateState(state)) throw new Error("状态变更破坏了案件约束");
  return freeze(state);
};

const elapsedHours = (state) => CASE.initialHours - state.hoursLeft;

export function createState() {
  return freeze({
    version: CASE.version,
    caseId: CASE.id,
    started: false,
    budget: CASE.initialBudget,
    hoursLeft: CASE.initialHours,
    actions: [],
    unlocked: CASE.evidence
      .filter((item) => item.initial)
      .map((item) => item.id),
    read: [],
    links: [],
    hypothesis: null,
    containment: null,
    containmentAt: null,
    exposure: 0,
    analysisViews: [],
    rationale: "",
    reflection: "",
    decision: null,
    log: [],
  });
}

export function startCase(state) {
  ensureState(state);
  if (state.started) return state;
  const next = cloneState(state);
  next.started = true;
  next.log.push({ time: 0, message: "案件开始" });
  return finishState(next);
}

export function takeAction(state, actionId) {
  ensureState(state);
  if (!state.started) throw new Error("请先开始案件");
  if (state.decision !== null) throw new Error("结论提交后调查已锁定");
  if (!state.containment) throw new Error("必须先选择遏制方案");
  if (typeof actionId !== "string" || !INVESTIGATIONS.has(actionId))
    throw new Error("调查行动不存在");
  if (state.actions.includes(actionId)) throw new Error("调查行动不能重复");
  const action = INVESTIGATIONS.get(actionId);
  if (state.budget < action.cost) throw new Error("预算不足");
  if (state.hoursLeft < action.hours) throw new Error("时间不足");

  const next = cloneState(state);
  next.budget -= action.cost;
  next.hoursLeft -= action.hours;
  next.actions.push(actionId);
  for (const evidenceId of action.evidenceIds) {
    if (!next.unlocked.includes(evidenceId)) next.unlocked.push(evidenceId);
  }
  next.exposure +=
    action.hours * (CONTAINMENT.get(state.containment).level === 0 ? 8 : 1);
  next.log.push({ time: elapsedHours(next), message: `调查：${action.title}` });
  return finishState(next);
}

export function setContainment(state, id) {
  ensureState(state);
  if (!state.started) throw new Error("请先开始案件");
  if (state.decision !== null) throw new Error("结论提交后遏制已锁定");
  if (typeof id !== "string" || !CONTAINMENT.has(id))
    throw new Error("遏制方案不存在");
  const option = CONTAINMENT.get(id);
  if (state.containment !== null) {
    const current = CONTAINMENT.get(state.containment);
    if (option.level === current.level) return state;
    if (option.level < current.level) throw new Error("遏制方案只能升级");
  }
  const currentCost = state.containment
    ? CONTAINMENT.get(state.containment).cost
    : 0;
  const difference = option.cost - currentCost;
  if (state.budget < difference) throw new Error("预算不足");

  const next = cloneState(state);
  next.budget -= difference;
  next.containment = id;
  if (option.level >= 1 && next.containmentAt === null)
    next.containmentAt = elapsedHours(state);
  next.log.push({
    time: elapsedHours(state),
    message: `遏制：${option.title}`,
  });
  return finishState(next);
}

export function markRead(state, evidenceId) {
  ensureState(state);
  if (state.decision !== null) throw new Error("结论提交后证据阅读已锁定");
  if (!knownEvidence(evidenceId)) throw new Error("证据不存在");
  if (!state.unlocked.includes(evidenceId)) throw new Error("证据尚未解锁");
  if (state.read.includes(evidenceId)) return state;
  const next = cloneState(state);
  next.read.push(evidenceId);
  return finishState(next);
}

export function linkEvidence(state, evidenceId, hypothesisId, relation) {
  ensureState(state);
  if (state.decision !== null) throw new Error("结论提交后证据链接已锁定");
  if (!knownEvidence(evidenceId) || !knownHypothesis(hypothesisId))
    throw new Error("证据或假设不存在");
  if (relation !== "none" && !RELATIONS.has(relation))
    throw new Error("证据关系不存在");
  if (!state.read.includes(evidenceId)) throw new Error("必须先阅读证据");

  const next = cloneState(state);
  const index = next.links.findIndex(
    (link) =>
      link.evidenceId === evidenceId && link.hypothesisId === hypothesisId,
  );
  if (relation === "none") {
    if (index < 0) return state;
    next.links.splice(index, 1);
  } else if (index < 0) {
    next.links.push({ evidenceId, hypothesisId, relation });
  } else if (next.links[index].relation === relation) {
    return state;
  } else {
    next.links[index] = { evidenceId, hypothesisId, relation };
  }
  return finishState(next);
}

export function chooseHypothesis(state, id) {
  ensureState(state);
  if (state.decision !== null) throw new Error("结论提交后假设已锁定");
  if (!knownHypothesis(id)) throw new Error("假设不存在");
  if (state.hypothesis === id) return state;
  const next = cloneState(state);
  next.hypothesis = id;
  return finishState(next);
}

export function recordAnalysis(state, key) {
  ensureState(state);
  if (state.decision !== null) throw new Error("结论提交后分析已锁定");
  if (!state.actions.includes("trace")) throw new Error("需要先完成批次追溯");
  if (typeof key !== "string" || key.trim().length === 0)
    throw new Error("分析视图名称不能为空");
  if (state.analysisViews.includes(key)) return state;
  const next = cloneState(state);
  next.analysisViews.push(key);
  return finishState(next);
}

export function setText(state, field, text) {
  ensureState(state);
  if (field !== "rationale" && field !== "reflection")
    throw new Error("文本字段不存在");
  if (typeof text !== "string") throw new Error("文本必须是字符串");
  if (state.decision !== null && field !== "reflection")
    throw new Error("提交后理由已锁定");
  if (state[field] === text) return state;
  const next = cloneState(state);
  next[field] = text;
  return finishState(next);
}

export function submitDecision(state, decision) {
  ensureState(state);
  if (!state.started) throw new Error("案件尚未开始");
  if (state.decision !== null) throw new Error("决策只能提交一次");
  if (!state.containment) throw new Error("必须选择遏制方案");
  if (!state.hypothesis) throw new Error("必须选择一个假设");
  if (state.rationale.trim().length < 20)
    throw new Error("理由至少需要 20 个字符");
  if (!validDecision(decision)) throw new Error("决策字段无效");

  const next = cloneState(state);
  next.decision = { ...decision };
  next.log.push({ time: elapsedHours(state), message: "提交决策" });
  return finishState(next);
}

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const correctLink = (link) =>
  CORRECT_LINKS.get(`${link.evidenceId}|${link.hypothesisId}`);

const scoreEvidence = (state) => {
  let raw = 0;
  let wrongPenalty = 0;
  let coveredWeight = 0;
  for (const evidence of CASE.evidence) {
    const weight = EVIDENCE_WEIGHTS[evidence.id];
    if (!state.read.includes(evidence.id)) continue;
    coveredWeight += weight;
    const links = state.links.filter((link) => link.evidenceId === evidence.id);
    const expected = links.some((link) => {
      const answer = correctLink(link);
      return answer && answer.relation === link.relation;
    });
    raw += expected ? weight : weight * 0.25;
    const wrong = links.filter((link) => {
      const answer = correctLink(link);
      return !answer || answer.relation !== link.relation;
    }).length;
    const penalty = Math.min(weight * 0.55, wrong * 2);
    wrongPenalty += penalty;
    raw -= penalty;
  }
  // 24 weighted points is the substantive coverage target. This lets a
  // careful, selective investigation reach the full process score without
  // requiring every expensive action.
  const score = Math.round(clamp((raw / 24) * 40, 0, 40));
  return { score, raw, wrongPenalty, coveredWeight };
};

const scoreHypothesis = (state) => {
  const selected = state.hypothesis;
  if (!selected)
    return {
      score: 0,
      base: 0,
      support: 0,
      contradictionPenalty: 0,
      analysisBonus: 0,
      alternativeBonus: 0,
    };
  const base = selected === "supplier" ? 12 : 8;
  let support = 0;
  let contradictionPenalty = 0;
  for (const link of state.links) {
    if (link.hypothesisId !== selected) continue;
    const answer = correctLink(link);
    if (
      answer &&
      answer.relation === link.relation &&
      answer.relation === "supports"
    ) {
      support += (EVIDENCE_WEIGHTS[link.evidenceId] || 0) * 0.5;
    } else if (
      answer &&
      answer.relation === link.relation &&
      answer.relation === "contradicts"
    ) {
      contradictionPenalty += (EVIDENCE_WEIGHTS[link.evidenceId] || 0) * 0.55;
    } else {
      contradictionPenalty += 2;
    }
  }
  let alternativeBonus = 0;
  for (const link of state.links) {
    if (link.hypothesisId === selected) continue;
    const answer = correctLink(link);
    if (
      answer &&
      answer.relation === link.relation &&
      (link.hypothesisId === "machine" || link.hypothesisId === "design")
    ) {
      alternativeBonus += 1.5;
    }
  }
  const analysisBonus = Math.min(4, state.analysisViews.length * 1.5);
  const wrongLinkPenalty =
    state.links.filter((link) => {
      const answer = correctLink(link);
      return !answer || answer.relation !== link.relation;
    }).length * 1.5;
  const score = Math.round(
    clamp(
      base +
        support +
        alternativeBonus +
        analysisBonus -
        contradictionPenalty -
        wrongLinkPenalty,
      0,
      30,
    ),
  );
  return {
    score,
    base,
    support,
    contradictionPenalty: contradictionPenalty + wrongLinkPenalty,
    analysisBonus,
    alternativeBonus,
  };
};

const scoreDecision = (state) => {
  const decision = state.decision;
  if (!decision || !state.containment)
    return {
      score: 0,
      containment: 0,
      timing: 0,
      supplier: 0,
      response: 0,
      inspection: 0,
    };
  const level = CONTAINMENT.get(state.containment).level;
  const containmentScore = level === 0 ? 0 : 10;
  const timingScore =
    state.containmentAt === null
      ? 0
      : state.containmentAt === 0
        ? 5
        : state.containmentAt <= 2
          ? 3
          : 1;
  const hasTrace =
    state.actions.includes("trace") &&
    state.read.includes("E03") &&
    state.read.includes("E04");
  const hasSourceEvidence =
    state.read.includes("E06") || state.read.includes("E08");
  const hasIncompleteSourceEvidence =
    state.read.includes("E05") ||
    state.read.includes("E06") ||
    state.read.includes("E08");
  const supplierScore =
    decision.supplier === "suspend"
      ? hasSourceEvidence
        ? 7
        : 1
      : decision.supplier === "verify"
        ? hasIncompleteSourceEvidence
          ? 5
          : 2
        : 1;
  const responseScore =
    decision.response === "targeted"
      ? hasTrace
        ? 5
        : 1
      : decision.response === "all"
        ? 4
        : 0;
  const inspectionScore = { enhanced: 3, standard: 1 }[decision.inspection];
  const score = clamp(
    containmentScore +
      timingScore +
      supplierScore +
      responseScore +
      inspectionScore,
    0,
    30,
  );
  return {
    score,
    containment: containmentScore,
    timing: timingScore,
    supplier: supplierScore,
    response: responseScore,
    inspection: inspectionScore,
  };
};

const outcomeFor = (state) => {
  const decision = state.decision;
  const level = CONTAINMENT.get(state.containment).level;
  const spent = CASE.initialBudget - state.budget;
  const exposureCost = Math.round(state.exposure / 8);
  const responseCost = { targeted: 4, all: 11, none: 0 }[decision.response];
  const supplierCost = { suspend: 6, verify: 3, keep: 0 }[decision.supplier];
  const inspectionCost = decision.inspection === "enhanced" ? 4 : 1;
  const costIndex =
    spent + exposureCost + responseCost + supplierCost + inspectionCost;
  const cost = costIndex * 1000;
  const leadTimeDays =
    2 +
    Math.ceil(elapsedHours(state) / 4) +
    (decision.response === "all" ? 2 : decision.response === "none" ? 4 : 0) +
    (level === 2 ? 2 : level === 1 ? 1 : 0) +
    Math.ceil(state.exposure / 16) +
    (decision.supplier === "suspend"
      ? 1
      : decision.supplier === "verify"
        ? 2
        : 0) +
    (decision.inspection === "enhanced" ? 1 : 0);
  const targetedScoped =
    state.actions.includes("trace") &&
    state.read.includes("E03") &&
    state.read.includes("E04");
  const lowRisk =
    level >= 1 &&
    decision.response !== "none" &&
    (decision.response !== "targeted" || targetedScoped) &&
    decision.supplier === "suspend" &&
    decision.inspection === "enhanced" &&
    state.exposure <= 8;
  const highRisk =
    level === 0 ||
    decision.response === "none" ||
    decision.supplier === "keep" ||
    (decision.response === "targeted" && !targetedScoped);
  const customerRisk = highRisk ? "高" : lowRisk ? "低" : "中";
  const headline =
    customerRisk === "低"
      ? "风险已被及时压低"
      : customerRisk === "中"
        ? "风险得到控制但仍需复核"
        : "仍有客户暴露风险";
  const scopeNote =
    decision.response === "targeted"
      ? targetedScoped
        ? "定向范围已有批次追溯依据"
        : "定向范围尚无完整批次追溯依据"
      : decision.response === "all"
        ? "全面范围覆盖未知批次"
        : "未启动召回范围";
  const summary = `示意成本指数 = 已用预算 ${spent} + 暴露 ${exposureCost} + 响应 ${responseCost} + 供应商处置 ${supplierCost} + 检验 ${inspectionCost} = ${costIndex}，按每点 ¥1,000 计为 ¥${cost}；${scopeNote}；供应商处置与检验另计交付影响，预计 ${leadTimeDays} 天。`;
  return { cost, leadTimeDays, customerRisk, headline, summary };
};

export function scoreCase(state) {
  ensureState(state);
  if (state.decision === null) throw new Error("结论尚未提交");
  const evidenceResult = scoreEvidence(state);
  const hypothesisResult = scoreHypothesis(state);
  const decisionResult = scoreDecision(state);
  const evidenceScore = evidenceResult.score;
  const hypothesisScore = hypothesisResult.score;
  const decisionScore = decisionResult.score;
  const wrongLinks = state.links.filter((link) => {
    const answer = correctLink(link);
    return !answer || answer.relation !== link.relation;
  });
  const strengths = [];
  if (evidenceScore >= 24)
    strengths.push("证据链覆盖了主要异常来源，并能把记录连接起来。");
  if (
    state.hypothesis === "supplier" &&
    state.links.some(
      (link) =>
        link.evidenceId === "E08" &&
        link.hypothesisId === "supplier" &&
        link.relation === "supports",
    )
  ) {
    strengths.push("把实验室样品的真伪结果与供应商假设相连。");
  }
  if (
    state.links.some(
      (link) =>
        link.evidenceId === "E07" &&
        link.hypothesisId === "machine" &&
        link.relation === "contradicts",
    )
  ) {
    strengths.push("用控制生产结果处理了设备假设，而不是只看一条证言。");
  }
  if (
    state.links.some(
      (link) =>
        link.evidenceId === "E09" &&
        link.hypothesisId === "design" &&
        link.relation === "contradicts",
    )
  ) {
    strengths.push("用设计版本和控制批次检验了设计假设。");
  }
  if (state.containmentAt !== null && state.containmentAt <= 2)
    strengths.push("在调查早期就建立了遏制，降低了后续暴露。");
  if (state.analysisViews.length > 0)
    strengths.push("使用了分析视图整理证据关系。");
  if (strengths.length === 0) strengths.push("完成了一个可复核的调查决策。");

  const auditSufficient =
    state.read.includes("E05") && state.read.includes("E06");
  const missed = CASE.truth.missed
    .filter((evidenceId) => !state.read.includes(evidenceId))
    .filter((evidenceId) => !(evidenceId === "E08" && auditSufficient))
    .map(
      (evidenceId) =>
        `${evidenceId} ${EVIDENCE.get(evidenceId).title}：补充这条记录可缩小剩余不确定性。`,
    );
  if (
    state.decision.response === "targeted" &&
    !(
      state.actions.includes("trace") &&
      state.read.includes("E03") &&
      state.read.includes("E04")
    )
  ) {
    missed.push(
      "处置范围：选择了定向召回，但尚未读完 E03 与 E04 的批次范围证据；结局因此保留较高客户风险。",
    );
  }
  if (wrongLinks.length > 0) {
    const relationLabel = (relation) =>
      relation === "supports" ? "支持" : "反驳";
    const wrongDetails = wrongLinks.map((link) => {
      const answer = correctLink(link);
      const expected = answer
        ? `；该证据登记为“${relationLabel(answer.relation)}”`
        : "；该证据没有可登记的区分性关系";
      return `${link.evidenceId} ${EVIDENCE.get(link.evidenceId).title} → ${HYPOTHESES.get(link.hypothesisId).title}（你标为“${relationLabel(link.relation)}”${expected}）`;
    });
    missed.push(
      `链接复核：${wrongDetails.join("；")}。这些关系已从过程分数扣除。`,
    );
  }

  return {
    total: evidenceScore + hypothesisScore + decisionScore,
    categories: [
      {
        id: "evidence",
        label: "证据整理",
        score: evidenceScore,
        max: 40,
        feedback: `原始权重 ${evidenceResult.raw.toFixed(1)} / 目标 24；已覆盖权重 ${evidenceResult.coveredWeight}，关系扣分 ${evidenceResult.wrongPenalty.toFixed(1)}；归一化、取整并限于 0–40 后：${evidenceScore}/40。`,
      },
      {
        id: "hypothesis",
        label: "假设论证",
        score: hypothesisScore,
        max: 30,
        feedback: `基础 ${hypothesisResult.base} + 支持 ${hypothesisResult.support.toFixed(1)} + 替代解释 ${hypothesisResult.alternativeBonus.toFixed(1)} + 分析 ${hypothesisResult.analysisBonus.toFixed(1)} − 矛盾与错误链接 ${hypothesisResult.contradictionPenalty.toFixed(1)}；取整并限于 0–30 后：${hypothesisScore}/30。`,
      },
      {
        id: "decision",
        label: "决策质量",
        score: decisionScore,
        max: 30,
        feedback: `遏制 ${decisionResult.containment} + 时点 ${decisionResult.timing} + 供应措施 ${decisionResult.supplier} + 产品处置 ${decisionResult.response} + 检验 ${decisionResult.inspection}；取整并限于 0–30 后：${decisionScore}/30。`,
      },
    ],
    outcome: outcomeFor(state),
    strengths,
    missed,
    truth: CASE.truth,
  };
}

export function serializeState(state) {
  ensureState(state);
  return JSON.stringify(state);
}

export function restoreState(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!validateState(parsed)) return null;
  return freeze(cloneState(parsed));
}
