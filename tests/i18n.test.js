import test from "node:test";
import assert from "node:assert/strict";
import { CASE } from "../src/case.js";
import * as engine from "../src/engine.js";
import {
  translateText,
  localizeAssessment,
  isLanguage,
} from "../src/i18n/index.js";

const han = /\p{Script=Han}/u;
const strings = (value) =>
  typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(strings)
      : value && typeof value === "object"
        ? Object.values(value).flatMap(strings)
        : [];

test("all case material has English display copy without changing canonical data", () => {
  const original = JSON.stringify(CASE);
  for (const source of strings(CASE).filter((value) => han.test(value))) {
    const english = translateText(source, "en");
    assert.equal(han.test(english), false, `${source}\n→ ${english}`);
    assert.equal(translateText(source, "zh-CN"), source);
  }
  assert.equal(JSON.stringify(CASE), original);
  assert.equal(translateText("E03 / B2405", "en"), "E03 / B2405");
  assert.equal(isLanguage("en"), true);
  assert.equal(isLanguage("zh-CN"), true);
  assert.equal(isLanguage("unexpected"), false);
});

test("English review covers wrong links, background context, calculations, and both evidence paths", () => {
  for (const path of [
    ["trace", "audit", "machine", "design"],
    ["trace", "lab", "interview"],
  ]) {
    let state = engine.setContainment(
      engine.startCase(engine.createState()),
      "hold",
    );
    for (const action of path) state = engine.takeAction(state, action);
    for (const id of state.unlocked) {
      state = engine.markRead(state, id);
      for (const hypothesis of CASE.hypotheses)
        state = engine.linkEvidence(state, id, hypothesis.id, "supports");
    }
    state = engine.recordAnalysis(
      state,
      "按供应商比较；供应商=全部；工厂=东一厂",
    );
    state = engine.chooseHypothesis(state, "supplier");
    state = engine.setText(
      state,
      "rationale",
      "Preserve this original rationale when changing the display language.",
    );
    state = engine.submitDecision(state, {
      response: "targeted",
      supplier: "suspend",
      inspection: "enhanced",
    });
    const saved = engine.serializeState(state);
    const original = engine.scoreCase(state);
    const english = localizeAssessment(original, "en");
    for (const text of strings(english))
      assert.equal(han.test(text), false, text);
    for (const entry of state.log)
      assert.equal(han.test(translateText(entry.message, "en")), false);
    assert.equal(han.test(translateText(state.analysisViews[0], "en")), false);
    assert.equal(english.total, original.total);
    assert.deepEqual(
      english.categories.map((c) => c.score),
      original.categories.map((c) => c.score),
    );
    assert.equal(engine.serializeState(state), saved);
    assert.deepEqual(engine.restoreState(saved), state);
  }
});

test("nested document names and scope messages keep their numbers and meaning", () => {
  const text = translateText("调查完成，2 份新材料已送达证据档案。", "en");
  assert.equal(han.test(text), false);
  assert.match(text, /2/);
  assert.match(
    translateText("查看 客户投诉趋势", "en"),
    /Customer complaint trend/,
  );
  assert.match(translateText("调查：追溯批次与物流", "en"), /^Investigation:/);
  assert.match(translateText("遏制：暂停 K2 出货", "en"), /K2/);
  assert.equal(translateText("  案件概览  ", "en"), "  Overview  ");
});
